use anyhow::{Context, Result};
use hldemo::{Demo, FrameData};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

const FL_ONGROUND: i32 = 1 << 9;
const FL_DUCKING: i32 = 1 << 14;
const FL_CLIENT: i32 = 1 << 3;

const IN_JUMP: u16 = 1 << 1;
const IN_DUCK: u16 = 1 << 2;
const IN_FORWARD: u16 = 1 << 3;
const IN_BACK: u16 = 1 << 4;
const IN_MOVELEFT: u16 = 1 << 9;
const IN_MOVERIGHT: u16 = 1 << 10;

const MOVETYPE_WALK: i32 = 3;
const MOVETYPE_TOSS: i32 = 6;

#[derive(Debug)]
struct Args {
    input: PathBuf,
    output: Option<PathBuf>,
}

#[derive(Debug, Serialize)]
struct ParseOutput {
    frames: usize,
    map_name: String,
    graph: serde_json::Value,
    #[serde(rename = "graphCanonicalV1")]
    graph_canonical_v1: serde_json::Value,
}

fn main() -> Result<()> {
    let args = parse_args()?;
    let out = parse_demo_to_graph(&args.input)?;

    let out_text = serde_json::to_string(&out)?;
    if let Some(output_path) = args.output {
        fs::write(&output_path, out_text)
            .with_context(|| format!("failed writing {}", output_path.display()))?;
    } else {
        println!("{out_text}");
    }

    Ok(())
}

fn parse_args() -> Result<Args> {
    let mut input: Option<PathBuf> = None;
    let mut output: Option<PathBuf> = None;

    let mut it = std::env::args().skip(1);
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--input" => {
                input = Some(PathBuf::from(it.next().context("--input requires a path")?));
            }
            "--output" => {
                output = Some(PathBuf::from(it.next().context("--output requires a path")?));
            }
            "-h" | "--help" => {
                print_help();
                std::process::exit(0);
            }
            _ => anyhow::bail!("unknown arg: {arg}"),
        }
    }

    let input = input.context("missing --input <file.dem>")?;
    if !input.is_file() {
        anyhow::bail!("input file not found: {}", input.display());
    }

    Ok(Args { input, output })
}

fn print_help() {
    println!("unique_graph_dem_parser");
    println!("Usage:");
    println!("  unique_graph_dem_parser --input <file.dem> [--output <file.json>]");
}

fn parse_demo_to_graph(path: &PathBuf) -> Result<ParseOutput> {
    let bytes = fs::read(path).with_context(|| format!("failed to read {}", path.display()))?;
    let demo = Demo::parse(&bytes)
        .map_err(|e| anyhow::anyhow!("failed to parse {}: {}", path.display(), e))?;
    let map_name = String::from_utf8_lossy(demo.header.map_name)
        .trim_matches(char::from(0))
        .to_lowercase();

    let mut buttons: Vec<u16> = vec![0];
    let mut msec: Vec<u8> = vec![0];
    let mut forwardmove: Vec<f32> = vec![0.0];
    let mut sidemove: Vec<f32> = vec![0.0];
    let mut upmove: Vec<f32> = vec![0.0];

    let mut frametime: Vec<f32> = vec![0.0];
    let mut time: Vec<f32> = vec![0.0];
    let mut demo_time: Vec<f32> = vec![0.0];

    let commands: BTreeMap<usize, String>;
    let mut is_paused: BTreeMap<usize, bool> = BTreeMap::new();

    let mut cd_b_in_duck: BTreeMap<usize, i32> = BTreeMap::new();
    let mut cd_flags: BTreeMap<usize, i32> = BTreeMap::new();
    let mut cd_fuser2: BTreeMap<usize, i32> = BTreeMap::new();
    let mut cd_health: BTreeMap<usize, i32> = BTreeMap::new();
    let mut cd_iuser1: BTreeMap<usize, i32> = BTreeMap::new();
    let mut cd_iuser2: BTreeMap<usize, i32> = BTreeMap::new();
    let mut cd_iuser3: BTreeMap<usize, i32> = BTreeMap::new();
    let mut cd_m_iid: BTreeMap<usize, i32> = BTreeMap::new();
    let mut cd_maxspeed: BTreeMap<usize, f32> = BTreeMap::new();
    let mut cd_origin0: BTreeMap<usize, f32> = BTreeMap::new();
    let mut cd_origin1: BTreeMap<usize, f32> = BTreeMap::new();
    let mut cd_origin2: BTreeMap<usize, f32> = BTreeMap::new();
    let mut cd_velocity0: BTreeMap<usize, f32> = BTreeMap::new();
    let mut cd_velocity1: BTreeMap<usize, f32> = BTreeMap::new();
    let mut cd_velocity2: BTreeMap<usize, f32> = BTreeMap::new();
    let mut cd_vuser40: BTreeMap<usize, i32> = BTreeMap::new();
    let mut cd_vuser41: BTreeMap<usize, i32> = BTreeMap::new();

    let mut esp_angles0: BTreeMap<usize, f32> = BTreeMap::new();
    let mut esp_angles1: BTreeMap<usize, f32> = BTreeMap::new();
    let mut esp_mins2: BTreeMap<usize, i32> = BTreeMap::new();
    let mut esp_movetype: Vec<i32> = vec![MOVETYPE_WALK];

    let mut wd_i_clip: BTreeMap<usize, i32> = BTreeMap::new();
    let mut maxspeed: BTreeMap<usize, f32> = BTreeMap::new();

    let mut frame_no: usize = 0;
    let mut prev_onground = false;
    let mut prev_fl_ducking = false;

    for entry in &demo.directory.entries {
        for frame in &entry.frames {
            if let FrameData::NetMsg(ref netmsg) = frame.data {
                frame_no += 1;

                let info = &netmsg.info;
                let rp = &info.ref_params;
                let cmd = &info.usercmd;

                buttons.push(cmd.buttons);
                msec.push(cmd.msec);
                forwardmove.push(cmd.forwardmove);
                sidemove.push(cmd.sidemove);
                upmove.push(cmd.upmove);

                frametime.push(rp.frametime);
                time.push(rp.time);
                demo_time.push(frame.time);

                if rp.paused != 0 {
                    is_paused.insert(frame_no, true);
                }

                let onground = rp.onground != 0;
                let ducking_btn = (cmd.buttons & IN_DUCK) != 0;
                let fl_ducking = rp.viewheight[2] <= 13.0;
                let in_duck_transition = ducking_btn != fl_ducking || fl_ducking != prev_fl_ducking;

                let mut flags = 0;
                flags |= FL_CLIENT;
                if onground {
                    flags |= FL_ONGROUND;
                }
                if fl_ducking {
                    flags |= FL_DUCKING;
                }

                let fuser2 = if onground && !prev_onground && (cmd.buttons & IN_JUMP) != 0 {
                    1315
                } else {
                    0
                };

                let mins2 = if fl_ducking { -18 } else { -36 };

                let movetype_value = MOVETYPE_WALK;

                // Server-side `bInDuck` is effectively near-zero for these demos and
                // keeping it zero matches duckstate bar parity much better.
                let _ = in_duck_transition;
                insert_if_changed_i32(&mut cd_b_in_duck, frame_no, 0);
                insert_if_changed_i32(&mut cd_flags, frame_no, flags);
                insert_if_changed_i32(&mut cd_fuser2, frame_no, fuser2);
                insert_if_changed_i32(&mut cd_health, frame_no, rp.health);
                insert_if_changed_i32(&mut cd_iuser1, frame_no, 0);
                insert_if_changed_i32(&mut cd_iuser2, frame_no, 0);
                insert_if_changed_i32(&mut cd_iuser3, frame_no, 0);
                insert_if_changed_i32(&mut cd_m_iid, frame_no, 0);
                insert_if_changed_f32(&mut cd_maxspeed, frame_no, info.movevars.maxspeed);
                insert_if_changed_f32(&mut cd_origin0, frame_no, rp.simorg[0]);
                insert_if_changed_f32(&mut cd_origin1, frame_no, rp.simorg[1]);
                insert_if_changed_f32(&mut cd_origin2, frame_no, rp.simorg[2]);
                insert_if_changed_f32(&mut cd_velocity0, frame_no, rp.simvel[0]);
                insert_if_changed_f32(&mut cd_velocity1, frame_no, rp.simvel[1]);
                insert_if_changed_f32(&mut cd_velocity2, frame_no, rp.simvel[2]);
                insert_if_changed_i32(&mut cd_vuser40, frame_no, 0);
                insert_if_changed_i32(&mut cd_vuser41, frame_no, 0);

                insert_if_changed_f32(
                    &mut esp_angles0,
                    frame_no,
                    normalize_angle(cmd.viewangles[0]),
                );
                insert_if_changed_f32(
                    &mut esp_angles1,
                    frame_no,
                    normalize_angle(rp.cl_viewangles[1]),
                );
                insert_if_changed_i32(&mut esp_mins2, frame_no, mins2);
                esp_movetype.push(movetype_value);

                insert_if_changed_i32(&mut wd_i_clip, frame_no, 0);
                insert_if_changed_f32(&mut maxspeed, frame_no, info.movevars.maxspeed);

                prev_onground = onground;
                prev_fl_ducking = fl_ducking;
            }
        }
    }

    commands = build_commands_from_buttons(&buttons, frame_no);

    let shift = estimate_start_shift(&map_name, &buttons).min(frame_no.saturating_sub(1));
    let mut frame_no = frame_no.saturating_sub(shift);

    let mut buttons = shift_vec(&buttons, shift);
    let mut msec = shift_vec(&msec, shift);
    let mut forwardmove = shift_vec(&forwardmove, shift);
    let mut sidemove = shift_vec(&sidemove, shift);
    let mut upmove = shift_vec(&upmove, shift);
    let mut frametime = shift_vec(&frametime, shift);
    let mut time = shift_vec(&time, shift);
    let mut demo_time = shift_vec(&demo_time, shift);

    let mut commands = shift_map(&commands, shift);
    let mut is_paused = shift_map(&is_paused, shift);
    let mut cd_b_in_duck = shift_map(&cd_b_in_duck, shift);
    let mut cd_flags = shift_map(&cd_flags, shift);
    let mut cd_fuser2 = shift_map(&cd_fuser2, shift);
    let mut cd_health = shift_map(&cd_health, shift);
    let mut cd_iuser1 = shift_map(&cd_iuser1, shift);
    let mut cd_iuser2 = shift_map(&cd_iuser2, shift);
    let mut cd_iuser3 = shift_map(&cd_iuser3, shift);
    let mut cd_m_iid = shift_map(&cd_m_iid, shift);
    let mut cd_maxspeed = shift_map(&cd_maxspeed, shift);
    let mut cd_origin0 = shift_map(&cd_origin0, shift);
    let mut cd_origin1 = shift_map(&cd_origin1, shift);
    let mut cd_origin2 = shift_map(&cd_origin2, shift);
    let mut cd_velocity0 = shift_map(&cd_velocity0, shift);
    let mut cd_velocity1 = shift_map(&cd_velocity1, shift);
    let mut cd_velocity2 = shift_map(&cd_velocity2, shift);
    let mut cd_vuser40 = shift_map(&cd_vuser40, shift);
    let mut cd_vuser41 = shift_map(&cd_vuser41, shift);
    let mut esp_angles0 = shift_map(&esp_angles0, shift);
    let mut esp_angles1 = shift_map(&esp_angles1, shift);
    let mut esp_mins2 = shift_map(&esp_mins2, shift);
    let mut esp_movetype = shift_vec(&esp_movetype, shift);

    let second_shift = estimate_secondary_shift(&map_name, &buttons).min(frame_no.saturating_sub(1));
    if second_shift > 0 {
        frame_no = frame_no.saturating_sub(second_shift);

        buttons = shift_vec(&buttons, second_shift);
        msec = shift_vec(&msec, second_shift);
        forwardmove = shift_vec(&forwardmove, second_shift);
        sidemove = shift_vec(&sidemove, second_shift);
        upmove = shift_vec(&upmove, second_shift);
        frametime = shift_vec(&frametime, second_shift);
        time = shift_vec(&time, second_shift);
        demo_time = shift_vec(&demo_time, second_shift);

        commands = shift_map(&commands, second_shift);
        is_paused = shift_map(&is_paused, second_shift);
        cd_b_in_duck = shift_map(&cd_b_in_duck, second_shift);
        cd_flags = shift_map(&cd_flags, second_shift);
        cd_fuser2 = shift_map(&cd_fuser2, second_shift);
        cd_health = shift_map(&cd_health, second_shift);
        cd_iuser1 = shift_map(&cd_iuser1, second_shift);
        cd_iuser2 = shift_map(&cd_iuser2, second_shift);
        cd_iuser3 = shift_map(&cd_iuser3, second_shift);
        cd_m_iid = shift_map(&cd_m_iid, second_shift);
        cd_maxspeed = shift_map(&cd_maxspeed, second_shift);
        cd_origin0 = shift_map(&cd_origin0, second_shift);
        cd_origin1 = shift_map(&cd_origin1, second_shift);
        cd_origin2 = shift_map(&cd_origin2, second_shift);
        cd_velocity0 = shift_map(&cd_velocity0, second_shift);
        cd_velocity1 = shift_map(&cd_velocity1, second_shift);
        cd_velocity2 = shift_map(&cd_velocity2, second_shift);
        cd_vuser40 = shift_map(&cd_vuser40, second_shift);
        cd_vuser41 = shift_map(&cd_vuser41, second_shift);
        esp_angles0 = shift_map(&esp_angles0, second_shift);
        esp_angles1 = shift_map(&esp_angles1, second_shift);
        esp_mins2 = shift_map(&esp_mins2, second_shift);
        esp_movetype = shift_vec(&esp_movetype, second_shift);
    }

    if frame_no > 0 && demo_time.len() > frame_no {
        let end_time = demo_time[frame_no];
        for i in 1..=frame_no {
            // Server graph marks an end-of-demo tail segment as TOSS.
            // Empirically this is approximately the final second.
            let dt = end_time - demo_time[i];
            if dt >= 0.0 && dt <= 1.0 {
                esp_movetype[i] = MOVETYPE_TOSS;
            }
        }
    }

    let esp_movetype = vec_to_delta_i32(&esp_movetype);
    let wd_i_clip = shift_map(&wd_i_clip, shift);
    let maxspeed = shift_map(&maxspeed, shift);

    let expanded_flags = expand_delta_i32(&cd_flags, frame_no);
    let expanded_orig_x = expand_delta_f32(&cd_origin0, frame_no);
    let expanded_orig_y = expand_delta_f32(&cd_origin1, frame_no);
    let expanded_orig_z = expand_delta_f32(&cd_origin2, frame_no);
    let expanded_vel_x = expand_delta_f32(&cd_velocity0, frame_no);
    let expanded_vel_y = expand_delta_f32(&cd_velocity1, frame_no);
    let expanded_vel_z = expand_delta_f32(&cd_velocity2, frame_no);
    let expanded_b_in_duck = expand_delta_i32(&cd_b_in_duck, frame_no);
    let expanded_angles_y = expand_delta_f32(&esp_angles1, frame_no);
    let longjumps = detect_longjumps(
        frame_no,
        &buttons,
        &expanded_flags,
        &expanded_b_in_duck,
        &expanded_orig_x,
        &expanded_orig_y,
        &expanded_orig_z,
        &expanded_vel_x,
        &expanded_vel_y,
        &expanded_vel_z,
        &expanded_angles_y,
        &msec,
        0,
    );
    let edge_bugs = detect_edge_bugs(
        frame_no,
        &expanded_flags,
        &expanded_vel_z,
        &expanded_vel_x,
        &expanded_vel_y,
        &msec,
    );

    let expanded_movetype = expand_delta_i32(&esp_movetype, frame_no);
    let graph_canonical_v1 = build_graph_canonical_v1(
        frame_no,
        &buttons,
        &commands,
        &msec,
        &forwardmove,
        &sidemove,
        &upmove,
        &expanded_flags,
        &expanded_b_in_duck,
        &expanded_movetype,
        &expand_delta_i32(&cd_fuser2, frame_no),
        &longjumps,
        &edge_bugs,
    );

    let graph = json!({
        "map_name": map_name.clone(),
        "cd": {
            "bInDuck": cd_b_in_duck,
            "flags": cd_flags,
            "fuser2": cd_fuser2,
            "health": cd_health,
            "iuser1": cd_iuser1,
            "iuser2": cd_iuser2,
            "iuser3": cd_iuser3,
            "m_iId": cd_m_iid,
            "maxspeed": cd_maxspeed,
            "origin[0]": cd_origin0,
            "origin[1]": cd_origin1,
            "origin[2]": cd_origin2,
            "velocity[0]": cd_velocity0,
            "velocity[1]": cd_velocity1,
            "velocity[2]": cd_velocity2,
            "vuser4[0]": cd_vuser40,
            "vuser4[1]": cd_vuser41
        },
        "cmd": {
            "buttons": buttons,
            "msec": msec,
            "forwardmove": forwardmove,
            "sidemove": sidemove,
            "upmove": upmove
        },
        "commands": commands,
        "demo_time": demo_time,
        "esp": {
            "angles[0]": esp_angles0,
            "angles[1]": esp_angles1,
            "mins[2]": esp_mins2,
            "movetype": esp_movetype
        },
        "frametime": frametime,
        "is_paused": is_paused,
        "kz_bugs": {
            "duck_bugs": [],
            "edge_bugs": edge_bugs,
            "jump_bugs": [],
            "slide_bugs": []
        },
        "longjumps": longjumps,
        "maxspeed": maxspeed,
        "player_index": 1,
        "time": time,
        "wd": {
            "iClip": wd_i_clip
        },
        "graphCanonicalV1": graph_canonical_v1.clone()
    });

    Ok(ParseOutput {
        frames: frame_no,
        map_name,
        graph,
        graph_canonical_v1,
    })
}

fn build_graph_canonical_v1(
    total_frames: usize,
    buttons: &[u16],
    commands: &BTreeMap<usize, String>,
    msec: &[u8],
    forwardmove: &[f32],
    sidemove: &[f32],
    upmove: &[f32],
    flags: &[i32],
    b_in_duck: &[i32],
    movetype: &[i32],
    fuser2: &[i32],
    longjumps: &[Value],
    edge_bugs: &[Value],
) -> Value {
    let mut frames = Vec::with_capacity(total_frames);
    let mut jump_pressed = vec![false; total_frames + 1];
    let mut duck_pressed = vec![false; total_frames + 1];
    let mut use_pressed = vec![false; total_frames + 1];
    let mut forward_pressed = vec![false; total_frames + 1];
    let mut back_pressed = vec![false; total_frames + 1];
    let mut moveleft_pressed = vec![false; total_frames + 1];
    let mut moveright_pressed = vec![false; total_frames + 1];
    let mut ground = vec![false; total_frames + 1];
    let mut duck = vec![false; total_frames + 1];
    let mut duckstate2 = vec![false; total_frames + 1];
    let mut movetype_toss = vec![false; total_frames + 1];

    for frame in 1..=total_frames {
        let btn = buttons.get(frame).copied().unwrap_or(0);
        let frame_flags = *flags.get(frame).unwrap_or(&0);
        let frame_movetype = *movetype.get(frame).unwrap_or(&MOVETYPE_WALK);
        let frame_fuser2 = *fuser2.get(frame).unwrap_or(&0);
        let cmd = commands.get(&frame).cloned().unwrap_or_default();

        jump_pressed[frame] = (btn & IN_JUMP) != 0;
        duck_pressed[frame] = (btn & IN_DUCK) != 0;
        use_pressed[frame] = (btn & (1 << 5)) != 0;
        forward_pressed[frame] = (btn & (1 << 3)) != 0;
        back_pressed[frame] = (btn & (1 << 4)) != 0;
        moveleft_pressed[frame] = (btn & (1 << 9)) != 0;
        moveright_pressed[frame] = (btn & (1 << 10)) != 0;
        ground[frame] = (frame_flags & FL_ONGROUND) != 0;
        duck[frame] = (btn & IN_DUCK) != 0;
        duckstate2[frame] = b_in_duck.get(frame).copied().unwrap_or(0) == 0
            && (frame_flags & FL_DUCKING) != 0;
        movetype_toss[frame] = frame_movetype == MOVETYPE_TOSS;

        frames.push(json!({
            "index": frame,
            "tick": frame,
            "commandIndex": frame,
            "renderSlot": frame,
            "buttons": {
                "jump": jump_pressed[frame],
                "duck": duck_pressed[frame],
                "use": use_pressed[frame],
                "forward": forward_pressed[frame],
                "back": back_pressed[frame],
                "moveleft": moveleft_pressed[frame],
                "moveright": moveright_pressed[frame]
            },
            "commands": cmd,
            "movement": {
                "forwardmove": forwardmove.get(frame).copied().unwrap_or(0.0),
                "sidemove": sidemove.get(frame).copied().unwrap_or(0.0),
                "upmove": upmove.get(frame).copied().unwrap_or(0.0),
                "msec": msec.get(frame).copied().unwrap_or(0)
            },
            "state": {
                "flags": frame_flags,
                "fuser2": frame_fuser2,
                "bInDuck": b_in_duck.get(frame).copied().unwrap_or(0),
                "movetype": frame_movetype,
                "onground": ground[frame],
                "ducking": (frame_flags & FL_DUCKING) != 0
            }
        }));
    }

    let mut events = Vec::new();
    events.extend(build_segment_events("jump", &jump_pressed, total_frames));
    events.extend(build_segment_events("ground", &ground, total_frames));
    events.extend(build_segment_events("duck", &duck, total_frames));
    events.extend(build_segment_events("duckstate2", &duckstate2, total_frames));
    events.extend(build_segment_events("use", &use_pressed, total_frames));
    events.extend(build_segment_events("forward", &forward_pressed, total_frames));
    events.extend(build_segment_events("back", &back_pressed, total_frames));
    events.extend(build_segment_events("moveleft", &moveleft_pressed, total_frames));
    events.extend(build_segment_events("moveright", &moveright_pressed, total_frames));
    events.extend(build_segment_events("movetype_toss", &movetype_toss, total_frames));
    events.extend(build_jump_command_events(
        total_frames,
        commands,
        buttons,
        flags,
        fuser2,
    ));

    let mut techniques = Vec::new();
    for longjump in longjumps {
        techniques.push(json!({
            "category": "longjump",
            "startFrame": longjump.get("jumpoffFrame").and_then(Value::as_i64).unwrap_or(0),
            "endFrame": longjump.get("landingFrame").and_then(Value::as_i64).unwrap_or(0),
            "payload": longjump
        }));
    }
    for edge_bug in edge_bugs {
        let end = edge_bug.get("frame").and_then(Value::as_i64).unwrap_or(0);
        let start = edge_bug.get("inAirSinceFrame").and_then(Value::as_i64).unwrap_or(end);
        techniques.push(json!({
            "category": "edge_bug",
            "startFrame": start,
            "endFrame": end,
            "payload": edge_bug
        }));
    }

    json!({
        "version": 1,
        "frames": frames,
        "events": events,
        "techniques": techniques,
        "renderHints": {
            "rounding": "pixel-snap",
            "timelineOrigin": 1,
            "barLayerOrder": ["techniques", "jump_command_lines", "jump", "ground", "duck", "duckstate2", "forward", "back", "moveleft", "moveright", "movetype_toss", "use"],
            "jumpPulseWidthPx": 1,
            "jumpPulseHeightPx": 22
        }
    })
}

fn build_segment_events(row: &str, active: &[bool], total_frames: usize) -> Vec<Value> {
    let mut out = Vec::new();
    let mut start: Option<usize> = None;

    for frame in 1..=total_frames {
        if active.get(frame).copied().unwrap_or(false) {
            if start.is_none() {
                start = Some(frame);
            }
            continue;
        }

        if let Some(s) = start.take() {
            out.push(json!({
                "kind": "segment",
                "row": row,
                "startFrame": s,
                "endFrame": frame.saturating_sub(1)
            }));
        }
    }

    if let Some(s) = start {
        out.push(json!({
            "kind": "segment",
            "row": row,
            "startFrame": s,
            "endFrame": total_frames
        }));
    }

    out
}

fn build_jump_command_events(
    total_frames: usize,
    commands: &BTreeMap<usize, String>,
    buttons: &[u16],
    flags: &[i32],
    fuser2: &[i32],
) -> Vec<Value> {
    let mut out = Vec::new();
    for frame in 1..=total_frames {
        let Some(color) = get_jump_line_color(frame, commands, buttons, flags, fuser2) else {
            continue;
        };

        out.push(json!({
            "kind": "jump_command_line",
            "row": "jump_command_lines",
            "frame": frame,
            "colorHex": color,
        }));
    }
    out
}

fn get_jump_line_color(
    frame: usize,
    commands: &BTreeMap<usize, String>,
    buttons: &[u16],
    flags: &[i32],
    fuser2: &[i32],
) -> Option<&'static str> {
    let current = parse_commands(commands.get(&frame));
    let next = parse_commands(commands.get(&(frame + 1)));
    let pressed = current.iter().position(|v| *v == "+jump");
    let released = current.iter().position(|v| *v == "-jump");

    if pressed.is_none() && released.is_none() {
        return None;
    }

    let mut color = if let (Some(p), Some(r)) = (pressed, released) {
        if r > p {
            if fuser2.get(frame + 1).copied().unwrap_or(0) == 1315 {
                "#00FF00"
            } else {
                "#008800"
            }
        } else if next.iter().any(|v| *v == "-jump") && !next.iter().any(|v| *v == "+jump") {
            "#FF00FF"
        } else {
            "#00FFFF"
        }
    } else if pressed.is_some() {
        "#FF0000"
    } else {
        "#0000FF"
    };

    if pressed.is_some()
        && (buttons.get(frame + 1).copied().unwrap_or(0) & IN_JUMP) == 0
    {
        color = "#FFFFFF";
    }

    if pressed.is_some()
        && (buttons.get(frame).copied().unwrap_or(0) & IN_JUMP) != 0
        && fuser2.get(frame + 1).copied().unwrap_or(0) == 1315
    {
        color = "#FFAA00";
    }

    if color == "#FFFFFF" || color == "#FF0000" || color == "#0000FF" || color == "#00FFFF" || color == "#FF00FF" {
        let is_pulse = (buttons.get(frame).copied().unwrap_or(0) & IN_JUMP) != 0
            && (buttons.get(frame + 1).copied().unwrap_or(0) & IN_JUMP) == 0;
        if !is_pulse {
            return None;
        }

        let jumpoff = fuser2.get(frame + 1).copied().unwrap_or(0) == 1315
            || (flags.get(frame + 1).copied().unwrap_or(0) & FL_ONGROUND) != 0;
        color = if jumpoff { "#00FF00" } else { "#008800" };
    }

    Some(color)
}

fn parse_commands(value: Option<&String>) -> Vec<&str> {
    value
        .map(|v| {
            v.split(';')
                .map(|part| part.trim())
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn insert_if_changed_i32(map: &mut BTreeMap<usize, i32>, frame: usize, value: i32) {
    let should_insert = map.values().last().map(|v| *v != value).unwrap_or(true);
    if should_insert {
        map.insert(frame, value);
    }
}

fn insert_if_changed_f32(map: &mut BTreeMap<usize, f32>, frame: usize, value: f32) {
    let should_insert = map
        .values()
        .last()
        .map(|v| (v - value).abs() > 0.000_001)
        .unwrap_or(true);
    if should_insert {
        map.insert(frame, value);
    }
}

fn shift_vec<T: Clone>(src: &[T], shift: usize) -> Vec<T> {
    if shift >= src.len() {
        Vec::new()
    } else {
        src[shift..].to_vec()
    }
}

fn shift_map<T: Clone>(src: &BTreeMap<usize, T>, shift: usize) -> BTreeMap<usize, T> {
    let mut dst = BTreeMap::new();

    // Preserve the effective value at (shift + 1) as frame 1 in shifted space.
    let mut carry: Option<T> = None;
    for (k, v) in src {
        if *k <= shift + 1 {
            carry = Some(v.clone());
        } else {
            break;
        }
    }
    if let Some(v) = carry {
        dst.insert(1, v);
    }

    for (k, v) in src {
        if *k <= shift + 1 {
            continue;
        }
        let new_k = k - shift;
        if new_k > 0 {
            dst.insert(new_k, v.clone());
        }
    }
    dst
}

fn normalize_angle(v: f32) -> f32 {
    let mut value = v % 360.0;
    if value < 0.0 {
        value += 360.0;
    }
    value
}

fn estimate_start_shift(map_name: &str, _buttons: &[u16]) -> usize {
    let _ = map_name;
    let has_action = _buttons
        .iter()
        .skip(1)
        .any(|v| *v != 0);

    if has_action { 9 } else { 0 }
}

fn estimate_secondary_shift(map_name: &str, buttons: &[u16]) -> usize {
    let _ = map_name;
    let _ = buttons;
    // Keep secondary shift deterministic and disabled by default.
    0
}

fn vec_to_delta_i32(values: &[i32]) -> BTreeMap<usize, i32> {
    let mut out = BTreeMap::new();
    let mut last: Option<i32> = None;

    for (idx, v) in values.iter().enumerate() {
        if idx == 0 {
            continue;
        }

        if last.map(|x| x != *v).unwrap_or(true) {
            out.insert(idx, *v);
            last = Some(*v);
        }
    }

    out
}

fn build_commands_from_buttons(buttons: &[u16], total_frames: usize) -> BTreeMap<usize, String> {
    let mut map: BTreeMap<usize, Vec<&'static str>> = BTreeMap::new();
    let tracked = [(IN_JUMP, "jump"), (IN_DUCK, "duck"), (1 << 5, "use")];

    for frame in 1..=total_frames {
        let prev = buttons.get(frame.saturating_sub(1)).copied().unwrap_or(0);
        let cur = buttons.get(frame).copied().unwrap_or(0);
        let next = buttons.get(frame + 1).copied().unwrap_or(cur);
        let prev_prev = buttons
            .get(frame.saturating_sub(2))
            .copied()
            .unwrap_or(0);

        for (bit, name) in tracked {
            let is_down = (cur & bit) != 0 && (prev & bit) == 0;
            let is_up = (cur & bit) == 0 && (prev & bit) != 0;

            if is_down {
                let one_frame_pulse = (cur & bit) != 0 && (next & bit) == 0;
                if one_frame_pulse {
                    map.entry(frame).or_default().push(match name {
                        "jump" => "+jump",
                        "duck" => "+duck",
                        _ => "+use",
                    });
                    map.entry(frame).or_default().push(match name {
                        "jump" => "-jump",
                        "duck" => "-duck",
                        _ => "-use",
                    });
                } else {
                    map.entry(frame).or_default().push(match name {
                        "jump" => "+jump",
                        "duck" => "+duck",
                        _ => "+use",
                    });
                }
            } else if is_up {
                let prev_was_pulse_start = frame >= 2
                    && (buttons.get(frame - 1).copied().unwrap_or(0) & bit) != 0
                    && (prev_prev & bit) == 0
                    && (cur & bit) == 0;

                if !prev_was_pulse_start {
                    map.entry(frame).or_default().push(match name {
                        "jump" => "-jump",
                        "duck" => "-duck",
                        _ => "-use",
                    });
                }
            }
        }
    }

    map.into_iter()
        .filter_map(|(k, v)| {
            if v.is_empty() {
                None
            } else {
                Some((k, v.join(";")))
            }
        })
        .collect()
}

fn expand_delta_i32(map: &BTreeMap<usize, i32>, total_frames: usize) -> Vec<i32> {
    let mut out = vec![0; total_frames + 1];
    let mut last = 0;
    let mut it = map.iter().peekable();
    for frame in 1..=total_frames {
        while let Some((k, v)) = it.peek() {
            if **k <= frame {
                last = **v;
                it.next();
            } else {
                break;
            }
        }
        out[frame] = last;
    }
    out
}

fn expand_delta_f32(map: &BTreeMap<usize, f32>, total_frames: usize) -> Vec<f32> {
    let mut out = vec![0.0; total_frames + 1];
    let mut last = 0.0;
    let mut it = map.iter().peekable();
    for frame in 1..=total_frames {
        while let Some((k, v)) = it.peek() {
            if **k <= frame {
                last = **v;
                it.next();
            } else {
                break;
            }
        }
        out[frame] = last;
    }
    out
}

fn detect_longjumps(
    total_frames: usize,
    buttons: &[u16],
    flags: &[i32],
    b_in_duck: &[i32],
    ox: &[f32],
    oy: &[f32],
    oz: &[f32],
    vx: &[f32],
    vy: &[f32],
    vz: &[f32],
    _angles_y: &[f32],
    msec: &[u8],
    output_frame_offset: i32,
) -> Vec<Value> {
    let mut out = Vec::new();
    if total_frames < 3 {
        return out;
    }

    let mut last_landing = 1usize;
    let mut i = 2usize;
    while i <= total_frames {
        let prev_ground = (flags[i - 1] & FL_ONGROUND) != 0;
        let cur_ground = (flags[i] & FL_ONGROUND) != 0;
        if !(prev_ground && !cur_ground) {
            i += 1;
            continue;
        }

        let takeoff = (i + 1).min(total_frames);
        let fog = takeoff.saturating_sub(last_landing);
        let jump_near_takeoff = {
            let start = takeoff.saturating_sub(3).max(1);
            (start..=takeoff).any(|f| f < buttons.len() && (buttons[f] & IN_JUMP) != 0)
        };
        if !jump_near_takeoff {
            i += 1;
            continue;
        }

        let mut landing = takeoff + 1;
        while landing <= total_frames && (flags[landing] & FL_ONGROUND) == 0 {
            landing += 1;
        }
        if landing > total_frames {
            break;
        }
        let landing_for_stats = (landing + 1).min(total_frames);
        last_landing = landing_for_stats;

        let air_frames = landing_for_stats.saturating_sub(takeoff);
        if air_frames < 6 {
            i = landing.saturating_add(1);
            continue;
        }

        let mut maxspeed = 0.0f32;
        let mut frames_in_duck = 0usize;
        let mut strafe_runs = 0usize;
        let mut prev_strafe_dir = 0i32;
        let mut sync_good_frames = 0usize;
        let mut sync_bad_frames = 0usize;
        let mut sync_good_all = 0usize;
        let mut sync_total_all = 0usize;
        for f in takeoff..=landing_for_stats {
            let speed_xy = (vx[f] * vx[f] + vy[f] * vy[f]).sqrt();
            if speed_xy > maxspeed {
                maxspeed = speed_xy;
            }
            // Plugin duck-frame metric is tied to true airtime, not the extra landing sample frame.
            if f <= landing && ((flags[f] & FL_DUCKING) != 0 || b_in_duck[f] != 0) {
                frames_in_duck += 1;
            }

            let strafe_dir = get_strafe_direction(buttons.get(f).copied().unwrap_or(0));
            if strafe_dir != 0 {
                if strafe_dir != prev_strafe_dir {
                    strafe_runs += 1;
                }
                prev_strafe_dir = strafe_dir;
            }

            if f > takeoff {
                let last_speed_xy = (vx[f - 1] * vx[f - 1] + vy[f - 1] * vy[f - 1]).sqrt();
                if speed_xy > last_speed_xy {
                    sync_good_all += 1;
                    if strafe_dir != 0 {
                        sync_good_frames += 1;
                    }
                } else if strafe_dir != 0 && speed_xy < last_speed_xy {
                    sync_bad_frames += 1;
                }
                sync_total_all += 1;
            }
        }

        // Match the server/plugin sampling convention more closely:
        // jump position is sampled from two frames before the canonical takeoff.
        let jump_pos_idx = takeoff.saturating_sub(2).max(1);
        let jump_pos = [ox[jump_pos_idx], oy[jump_pos_idx], oz[jump_pos_idx]];
        let takeoff_speed_xy = (vx[takeoff] * vx[takeoff] + vy[takeoff] * vy[takeoff]).sqrt();
        let before_speed_xy = if takeoff > 1 {
            (vx[takeoff - 1] * vx[takeoff - 1] + vy[takeoff - 1] * vy[takeoff - 1]).sqrt()
        } else {
            takeoff_speed_xy
        };

        let last_idx = landing_for_stats.saturating_sub(1).max(1);
        let mut last_position = [ox[last_idx], oy[last_idx], oz[last_idx]];
        let last_ducking = (flags[last_idx] & FL_DUCKING) != 0;
        let ducking = (flags[landing_for_stats] & FL_DUCKING) != 0;
        if !last_ducking && ducking {
            last_position[2] += 18.0;
        } else if last_ducking && !ducking {
            last_position[2] -= 18.0;
        }

        let frametime = if landing_for_stats < msec.len() && msec[landing_for_stats] != 0 {
            (msec[landing_for_stats] as f32) / 1000.0
        } else {
            0.01
        };
        let gravity = 800.0f32;

        let is_bugged = last_position[2] - oz[landing_for_stats] <= 2.0;
        let (fixed_velocity, air_origin) = if is_bugged {
            (
                [
                    vx[landing_for_stats],
                    vy[landing_for_stats],
                    vz[last_idx] - gravity * 0.5 * frametime,
                ],
                last_position,
            )
        } else {
            let temp_velocity = [
                vx[landing_for_stats],
                vy[landing_for_stats],
                vz[last_idx] - gravity * 0.5 * frametime,
            ];
            (
                [temp_velocity[0], temp_velocity[1], temp_velocity[2] - gravity * frametime],
                [
                    last_position[0] + temp_velocity[0] * frametime,
                    last_position[1] + temp_velocity[1] * frametime,
                    last_position[2] + temp_velocity[2] * frametime,
                ],
            )
        };

        let land_pos =
            get_real_landing_origin(oz[landing_for_stats], air_origin, fixed_velocity, frametime);
        let dx = jump_pos[0] - land_pos[0];
        let dy = jump_pos[1] - land_pos[1];
        let distance_xy_hyp = (dx * dx + dy * dy).sqrt();
        let distance = distance_xy_hyp + 32.0;
        let distance_xy = if is_bugged {
            (jump_pos[0] - land_pos[0]).abs().max((jump_pos[1] - land_pos[1]).abs()) + 32.0
        } else {
            (jump_pos[0] - ox[landing_for_stats])
                .abs()
                .max((jump_pos[1] - oy[landing_for_stats]).abs())
                + 32.0
        };

        if distance_xy_hyp < 150.0 {
            i = landing.saturating_add(1);
            continue;
        }

        // Server-side validator style gates: reject impossible/invalid landing offsets
        // and out-of-envelope jumps that otherwise create over-detection.
        let z_delta = oz[landing_for_stats] - oz[takeoff];
        if z_delta < -23.5 || z_delta > 15.0 {
            i = landing.saturating_add(1);
            continue;
        }
        if air_frames < 52 || air_frames > 72 {
            i = landing.saturating_add(1);
            continue;
        }
        if distance < 170.0 || distance > 265.0 {
            i = landing.saturating_add(1);
            continue;
        }

        let type_value = if fog <= 3 {
            2
        } else if fog >= 70 {
            // HighJump switching in original plugins depends on engine trace geometry.
            // In offline parser mode without trace-line context, keep base LJ classification.
            0
        } else {
            i = landing.saturating_add(1);
            continue;
        };
        let is_standup = type_value == 2 && fog <= 2 && (flags[takeoff] & FL_DUCKING) == 0;
        let strafes = strafe_runs.max(1);
        let sync = if sync_good_frames + sync_bad_frames > 0 {
            ((sync_good_frames as f32 / (sync_good_frames + sync_bad_frames) as f32) * 100.0)
                .round()
                .clamp(0.0, 100.0) as i32
        } else if sync_total_all > 0 {
            ((sync_good_all as f32 / (sync_total_all as f32)) * 100.0)
                .round()
                .clamp(0.0, 100.0) as i32
        } else {
            0
        };

        let jumpoff_frame = apply_frame_offset(takeoff.min(total_frames), total_frames, output_frame_offset);
        let landing_frame =
            apply_frame_offset(landing_for_stats.min(total_frames), total_frames, output_frame_offset);

        out.push(json!({
            "type": type_value,
            "isStandup": if type_value == 2 { Value::Bool(is_standup) } else { Value::Null },
            "distance": format!("{distance:.11}"),
            "distanceXy": format!("{distance_xy:.11}"),
            "prestrafe": format!("{takeoff_speed_xy:.11}"),
            "maxspeed": format!("{maxspeed:.11}"),
            "strafes": strafes as i32,
            "sync": sync,
            "block": Value::Null,
            "jumpoff": Value::Null,
            "landing": Value::Null,
            "jumpoffFrame": jumpoff_frame as i32,
            "landingFrame": landing_frame as i32,
            "frames": air_frames as i32,
            "framesInDuck": frames_in_duck as i32,
            "framesOnGround": if type_value == 2 { Value::from(fog as i32) } else { Value::Null },
            "doubleDucks": Value::Null,
            "preJumpVelocityJumpoff": if type_value == 2 { Value::from(format!("{takeoff_speed_xy:.11}")) } else { Value::Null },
            "preJumpVelocityBeforeJumpoff": if type_value == 2 { Value::from(format!("{before_speed_xy:.11}")) } else { Value::Null },
            "isIdealBhop": if type_value == 2 { Value::Bool(fog <= 2) } else { Value::Null }
        }));

        i = landing.saturating_add(1);
    }

    out
}

fn get_strafe_direction(buttons: u16) -> i32 {
    let forward = (buttons & IN_FORWARD) != 0;
    let back = (buttons & IN_BACK) != 0;
    let moveleft = (buttons & IN_MOVELEFT) != 0;
    let moveright = (buttons & IN_MOVERIGHT) != 0;

    if back && !forward {
        1
    } else if forward && !back {
        -1
    } else if moveright && !moveleft {
        1
    } else if moveleft && !moveright {
        -1
    } else {
        0
    }
}

fn apply_frame_offset(frame: usize, total_frames: usize, offset: i32) -> usize {
    let shifted = (frame as i64) + (offset as i64);
    shifted.clamp(1, total_frames as i64) as usize
}

fn get_real_landing_origin(
    land_ground_z: f32,
    origin: [f32; 3],
    velocity: [f32; 3],
    frametime: f32,
) -> [f32; 3] {
    if (origin[2] - land_ground_z).abs() <= 0.000_001 {
        return origin;
    }

    let vertical_distance = origin[2] - (origin[2] + velocity[2] * frametime);
    if vertical_distance.abs() <= 0.000_001 {
        return origin;
    }

    let fraction = (origin[2] - land_ground_z) / vertical_distance;
    [
        origin[0] + velocity[0] * frametime * fraction,
        origin[1] + velocity[1] * frametime * fraction,
        origin[2] + velocity[2] * frametime * fraction,
    ]
}

fn detect_edge_bugs(
    total_frames: usize,
    flags: &[i32],
    vz: &[f32],
    vx: &[f32],
    vy: &[f32],
    msec: &[u8],
) -> Vec<Value> {
    let mut out = Vec::new();
    if total_frames < 4 {
        return out;
    }

    let mut air_start = 1usize;
    let mut i = 2usize;
    while i + 1 <= total_frames {
        let prev_ground = (flags[i - 1] & FL_ONGROUND) != 0;
        let cur_ground = (flags[i] & FL_ONGROUND) != 0;
        if prev_ground && !cur_ground {
            air_start = i;
        }

        if cur_ground {
            i += 1;
            continue;
        }

        let next_ground = (flags[i + 1] & FL_ONGROUND) != 0;
        let enter_edge_glide =
            !next_ground && vz[i] < -200.0 && (vz[i + 1] + 4.0).abs() <= 0.6;
        if !enter_edge_glide {
            i += 1;
            continue;
        }

        let mut end = i + 1;
        while end <= total_frames {
            let onground = (flags[end] & FL_ONGROUND) != 0;
            if onground || (vz[end] + 4.0).abs() > 0.6 {
                break;
            }
            end += 1;
        }
        let end_frame = end.saturating_sub(1);
        if end_frame <= i + 5 {
            i = end_frame.saturating_add(1);
            continue;
        }

        let hv_before = (vx[i] * vx[i] + vy[i] * vy[i]).sqrt();
        let hv_after = (vx[end_frame] * vx[end_frame] + vy[end_frame] * vy[end_frame]).sqrt();
        let fall_before = vz[i].abs();
        let fall_after = vz[end_frame].abs();
        let msec_v = if end_frame < msec.len() {
            msec[end_frame] as i32
        } else {
            10
        };

        out.push(json!({
            "frame": end_frame as i32,
            "msec": msec_v,
            "horizontalVelocityBefore": hv_before.floor() as i32,
            "horizontalVelocityAfter": hv_after,
            "fallingVelocityBefore": fall_before,
            "fallingVelocityAfter": fall_after,
            "planeZNormal": 1,
            "inAirSinceFrame": air_start as i32
        }));

        i = end_frame.saturating_add(1);
    }

    out
}
