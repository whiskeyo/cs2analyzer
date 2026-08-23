//! World-to-radar calibration for competitive CS2 maps.

#[derive(Debug, Clone)]
pub struct MapCalibration {
    pub name: &'static str,
    pub pos_x: f32,
    pub pos_y: f32,
    pub scale: f32,
    pub radar: &'static str,
    pub lower_radar: Option<&'static str>,
    pub floors: &'static [VerticalSection],
}

#[derive(Debug, Clone, Copy)]
pub struct VerticalSection {
    pub name: &'static str,
    pub z_min: f32,
    pub z_max: f32,
}

impl MapCalibration {
    /// Convert world XY to radar-image pixels (typically a 1024×1024 overview).
    pub fn world_to_radar(&self, x: f32, y: f32) -> (f32, f32) {
        let px = (x - self.pos_x) / self.scale;
        let py = (self.pos_y - y) / self.scale;
        (px, py)
    }

    /// Which vertical section a world Z belongs to (`"default"` or `"lower"`).
    pub fn floor_for_z(&self, z: f32) -> &'static str {
        for floor in self.floors {
            if z >= floor.z_min && z < floor.z_max {
                return floor.name;
            }
        }
        "default"
    }
}

const DUST2: MapCalibration = MapCalibration {
    name: "de_dust2",
    pos_x: -2476.0,
    pos_y: 3239.0,
    scale: 4.4,
    radar: "de_dust2.png",
    lower_radar: None,
    floors: &[],
};

const MIRAGE: MapCalibration = MapCalibration {
    name: "de_mirage",
    pos_x: -3230.0,
    pos_y: 1713.0,
    scale: 5.0,
    radar: "de_mirage.png",
    lower_radar: None,
    floors: &[],
};

const INFERNO: MapCalibration = MapCalibration {
    name: "de_inferno",
    pos_x: -2087.0,
    pos_y: 3870.0,
    scale: 4.9,
    radar: "de_inferno.png",
    lower_radar: None,
    floors: &[],
};

const NUKE_FLOORS: &[VerticalSection] = &[
    VerticalSection {
        name: "default",
        z_min: -495.0,
        z_max: 10000.0,
    },
    VerticalSection {
        name: "lower",
        z_min: -10000.0,
        z_max: -495.0,
    },
];

const NUKE: MapCalibration = MapCalibration {
    name: "de_nuke",
    pos_x: -3453.0,
    pos_y: 2887.0,
    scale: 7.0,
    radar: "de_nuke.png",
    lower_radar: Some("de_nuke_lower.png"),
    floors: NUKE_FLOORS,
};

const OVERPASS: MapCalibration = MapCalibration {
    name: "de_overpass",
    pos_x: -4831.0,
    pos_y: 1781.0,
    scale: 5.2,
    radar: "de_overpass.png",
    lower_radar: None,
    floors: &[],
};

const ANCIENT: MapCalibration = MapCalibration {
    name: "de_ancient",
    pos_x: -2953.0,
    pos_y: 2164.0,
    scale: 5.0,
    radar: "de_ancient.png",
    lower_radar: None,
    floors: &[],
};

const ANUBIS: MapCalibration = MapCalibration {
    name: "de_anubis",
    pos_x: -2796.0,
    pos_y: 3328.0,
    scale: 5.22,
    radar: "de_anubis.png",
    lower_radar: None,
    floors: &[],
};

const VERTIGO_FLOORS: &[VerticalSection] = &[
    VerticalSection {
        name: "default",
        z_min: 11700.0,
        z_max: 20000.0,
    },
    VerticalSection {
        name: "lower",
        z_min: -10000.0,
        z_max: 11700.0,
    },
];

const VERTIGO: MapCalibration = MapCalibration {
    name: "de_vertigo",
    pos_x: -3168.0,
    pos_y: 1762.0,
    scale: 4.0,
    radar: "de_vertigo.png",
    lower_radar: Some("de_vertigo_lower.png"),
    floors: VERTIGO_FLOORS,
};

const TRAIN_FLOORS: &[VerticalSection] = &[
    VerticalSection {
        name: "default",
        z_min: -50.0,
        z_max: 20000.0,
    },
    VerticalSection {
        name: "lower",
        z_min: -5000.0,
        z_max: -50.0,
    },
];

const TRAIN: MapCalibration = MapCalibration {
    name: "de_train",
    pos_x: -2308.0,
    pos_y: 2078.0,
    scale: 4.082077,
    radar: "de_train.png",
    lower_radar: Some("de_train_lower.png"),
    floors: TRAIN_FLOORS,
};

/// Competitive-pool maps with radar calibration.
pub const MAPS: &[MapCalibration] = &[
    DUST2, MIRAGE, INFERNO, NUKE, OVERPASS, ANCIENT, ANUBIS, VERTIGO, TRAIN,
];

/// Look up calibration by map name (`de_dust2`, workshop suffixes stripped).
pub fn calibration(map_name: &str) -> Option<&'static MapCalibration> {
    let name = map_name.rsplit('/').next().unwrap_or(map_name);
    let name = name.trim_end_matches("_scrimmagemap");
    MAPS.iter().find(|m| m.name == name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn origin_maps_to_zero() {
        let c = calibration("de_dust2").unwrap();
        let (px, py) = c.world_to_radar(c.pos_x, c.pos_y);
        assert!((px).abs() < 1e-4);
        assert!((py).abs() < 1e-4);
    }

    #[test]
    fn nuke_lower_floor() {
        let c = calibration("workshop/123/de_nuke").unwrap();
        assert_eq!(c.floor_for_z(-800.0), "lower");
        assert_eq!(c.floor_for_z(0.0), "default");
        assert!(c.lower_radar.is_some());
    }
}
