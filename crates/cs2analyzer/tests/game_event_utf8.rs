//! Regression: GOTV can put non-UTF-8 bytes in game-event string keys.
//! Stock prost `string` fields abort the parse; source2-demo decodes them as `bytes`.

use source2_demo::proto::csvc_msg_game_event::KeyT;
use source2_demo::proto::Message;

#[test]
fn game_event_key_decodes_non_utf8_val_string() {
    // Field 1 type=1, field 2 length-delimited payload [0xC3, 0x28] (invalid UTF-8).
    // Wire layout is identical for protobuf string and bytes.
    let wire = [0x08, 0x01, 0x12, 0x02, 0xC3, 0x28];
    let key = KeyT::decode(wire.as_slice()).expect("non-utf8 val_string must decode");
    assert_eq!(key.r#type, Some(1));
    assert_eq!(key.val_string.as_deref(), Some(&[0xC3_u8, 0x28][..]));
}
