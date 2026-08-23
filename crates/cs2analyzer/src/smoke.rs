//! Decode CS2 `m_VoxelFrameData` occupancy for radar blobs.
//!
//! The blob is a journal of `{u16 seq, u16 len, payload}` records. Occupancy
//! frames fully replace the previous voxel set. Grid is 32³, 20 world units per
//! cell, centred on the detonation origin; world X is mirrored.
//! Format matches the reverse-engineered client journal (cs2parser).

const GRID: i32 = 32;
const CELL: f32 = 20.0;
const CENTER: f32 = 16.0;
const OCCUPANCY: u8 = 1;
const ENTRY: usize = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct GridVoxel {
    pub x: u8,
    pub y: u8,
    pub z: u8,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct XySeed {
    pub key: (i16, i16),
    pub x: f32,
    pub y: f32,
}

pub(crate) fn voxel_to_world(gx: u8, gy: u8, gz: u8, origin: (f32, f32, f32)) -> (f32, f32, f32) {
    (
        -(gx as f32 - CENTER) * CELL + origin.0,
        (gy as f32 - CENTER) * CELL + origin.1,
        (gz as f32 - CENTER) * CELL + origin.2,
    )
}

/// Last occupancy list in `data` (truncated to `size`). `None` if no occupancy frame.
pub(crate) fn last_occupancy(data: &[u8], size: usize) -> Option<Vec<GridVoxel>> {
    let end = size.min(data.len());
    let mut off = 0;
    let mut latest = None;
    while off + 4 <= end {
        let len = u16::from_le_bytes([data[off + 2], data[off + 3]]) as usize;
        let start = off + 4;
        if start + len > end {
            break;
        }
        if let Some(voxels) = occupancy_payload(&data[start..start + len]) {
            latest = Some(voxels);
        }
        off = start + len;
    }
    latest
}

/// Unique XY seeds in world space (stacked Z at the same cell collapse).
pub(crate) fn occupancy_xy(
    data: &[u8],
    size: usize,
    origin: (f32, f32, f32),
) -> Option<Vec<XySeed>> {
    let voxels = last_occupancy(data, size)?;
    let mut out: Vec<XySeed> = Vec::new();
    for v in voxels {
        if v.x as i32 >= GRID || v.y as i32 >= GRID {
            continue;
        }
        let key = (v.x as i16, v.y as i16);
        if out.iter().any(|s| s.key == key) {
            continue;
        }
        let (x, y, _) = voxel_to_world(v.x, v.y, v.z, origin);
        out.push(XySeed { key, x, y });
    }
    Some(out)
}

fn occupancy_payload(payload: &[u8]) -> Option<Vec<GridVoxel>> {
    if payload.len() < 2 || (payload[1] & OCCUPANCY) == 0 {
        return None;
    }
    if payload.len() < 3 {
        return Some(Vec::new());
    }
    let count = payload[2] as usize;
    let mut voxels = Vec::with_capacity(count);
    let mut off = 3;
    for _ in 0..count {
        if off + ENTRY > payload.len() {
            break;
        }
        voxels.push(GridVoxel {
            z: payload[off],
            y: payload[off + 1],
            x: payload[off + 2],
        });
        off += ENTRY;
    }
    Some(voxels)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn occupancy_record(seq: u16, voxels: &[(u8, u8, u8)]) -> Vec<u8> {
        let payload_len = 3 + voxels.len() * ENTRY;
        let mut out = Vec::with_capacity(4 + payload_len);
        out.extend_from_slice(&seq.to_le_bytes());
        out.extend_from_slice(&(payload_len as u16).to_le_bytes());
        out.push(1);
        out.push(OCCUPANCY);
        out.push(voxels.len() as u8);
        for &(x, y, z) in voxels {
            out.extend_from_slice(&[z, y, x, 0, 0, 0, 0, 0]);
        }
        out
    }

    fn heartbeat(seq: u16) -> Vec<u8> {
        let mut out = Vec::from(seq.to_le_bytes());
        out.extend_from_slice(&3u16.to_le_bytes());
        out.extend_from_slice(&[0, 0, 0]);
        out
    }

    #[test]
    fn centre_voxel_maps_to_origin() {
        let (x, y, z) = voxel_to_world(16, 16, 16, (100.0, 200.0, 30.0));
        assert!((x - 100.0).abs() < f32::EPSILON);
        assert!((y - 200.0).abs() < f32::EPSILON);
        assert!((z - 30.0).abs() < f32::EPSILON);
    }

    #[test]
    fn world_x_is_mirrored() {
        let (x, y, _) = voxel_to_world(17, 16, 16, (0.0, 0.0, 0.0));
        assert!((x + 20.0).abs() < f32::EPSILON);
        assert!(y.abs() < f32::EPSILON);
    }

    #[test]
    fn last_occupancy_skips_heartbeats() {
        let mut blob = occupancy_record(0, &[(16, 16, 16), (17, 16, 16)]);
        blob.extend_from_slice(&heartbeat(1));
        let voxels = last_occupancy(&blob, blob.len()).unwrap();
        assert_eq!(voxels.len(), 2);
        assert_eq!(
            voxels[1],
            GridVoxel {
                x: 17,
                y: 16,
                z: 16
            }
        );
    }

    #[test]
    fn occupancy_replace_clears_old_cells() {
        let mut blob = occupancy_record(0, &[(16, 16, 16), (18, 16, 16)]);
        blob.extend_from_slice(&occupancy_record(2, &[(16, 17, 16)]));
        let xy = occupancy_xy(&blob, blob.len(), (0.0, 0.0, 0.0)).unwrap();
        assert_eq!(xy.len(), 1);
        assert_eq!(xy[0].key, (16, 17));
    }

    #[test]
    fn stacked_z_collapses_on_radar() {
        let blob = occupancy_record(0, &[(16, 16, 10), (16, 16, 20)]);
        let xy = occupancy_xy(&blob, blob.len(), (5.0, 6.0, 0.0)).unwrap();
        assert_eq!(xy.len(), 1);
        assert!((xy[0].x - 5.0).abs() < f32::EPSILON);
        assert!((xy[0].y - 6.0).abs() < f32::EPSILON);
    }
}
