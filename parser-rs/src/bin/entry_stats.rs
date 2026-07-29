use hldemo::{Demo, FrameData};
use std::fs;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("usage: entry_stats <demo.dem>");
        std::process::exit(1);
    }

    let bytes = fs::read(&args[1]).expect("read demo");
    let demo = Demo::parse(&bytes).expect("parse demo");

    let mut total_netmsg = 0usize;

    for (entry_index, entry) in demo.directory.entries.iter().enumerate() {
        let mut netmsg = 0usize;
        let mut total = 0usize;
        for frame in &entry.frames {
            total += 1;
            if let FrameData::NetMsg(_) = frame.data {
                netmsg += 1;
                total_netmsg += 1;
            }
        }

        println!("entry={} type={} frames={} netmsg={}", entry_index, entry.entry_type, total, netmsg);
    }

    println!("total_netmsg={}", total_netmsg);
}
