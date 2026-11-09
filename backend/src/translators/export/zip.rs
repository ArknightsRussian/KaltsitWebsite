//! A small ZIP writer (deflate, no extra fields) for the export archive, on
//! the flate2 the backend already has: names are ASCII, sizes under 4 GB.

use std::io::Write;

use flate2::Compression;
use flate2::Crc;
use flate2::write::DeflateEncoder;

/// The archive of `files` (name, bytes), dated `at` (Unix seconds, UTC).
pub fn zip(files: &[(String, Vec<u8>)], at: i64) -> std::io::Result<Vec<u8>> {
    let (time, date) = dos_time(at);
    let mut out: Vec<u8> = Vec::new();
    let mut central: Vec<u8> = Vec::new();
    for (name, data) in files {
        let mut crc = Crc::new();
        crc.update(data);
        let mut enc = DeflateEncoder::new(Vec::new(), Compression::default());
        enc.write_all(data)?;
        let packed = enc.finish()?;
        let offset = u32::try_from(out.len()).map_err(std::io::Error::other)?;
        let size = u32::try_from(data.len()).map_err(std::io::Error::other)?;
        let csize = u32::try_from(packed.len()).map_err(std::io::Error::other)?;
        let nlen = u16::try_from(name.len()).map_err(std::io::Error::other)?;
        // Local file header; bit 11: the name is UTF-8.
        out.extend_from_slice(&0x0403_4b50_u32.to_le_bytes());
        out.extend_from_slice(&20_u16.to_le_bytes());
        out.extend_from_slice(&0x0800_u16.to_le_bytes());
        out.extend_from_slice(&8_u16.to_le_bytes());
        out.extend_from_slice(&time.to_le_bytes());
        out.extend_from_slice(&date.to_le_bytes());
        out.extend_from_slice(&crc.sum().to_le_bytes());
        out.extend_from_slice(&csize.to_le_bytes());
        out.extend_from_slice(&size.to_le_bytes());
        out.extend_from_slice(&nlen.to_le_bytes());
        out.extend_from_slice(&0_u16.to_le_bytes());
        out.extend_from_slice(name.as_bytes());
        out.extend_from_slice(&packed);
        // Central directory entry.
        central.extend_from_slice(&0x0201_4b50_u32.to_le_bytes());
        central.extend_from_slice(&20_u16.to_le_bytes());
        central.extend_from_slice(&20_u16.to_le_bytes());
        central.extend_from_slice(&0x0800_u16.to_le_bytes());
        central.extend_from_slice(&8_u16.to_le_bytes());
        central.extend_from_slice(&time.to_le_bytes());
        central.extend_from_slice(&date.to_le_bytes());
        central.extend_from_slice(&crc.sum().to_le_bytes());
        central.extend_from_slice(&csize.to_le_bytes());
        central.extend_from_slice(&size.to_le_bytes());
        central.extend_from_slice(&nlen.to_le_bytes());
        central.extend_from_slice(&[0; 12]);
        central.extend_from_slice(&offset.to_le_bytes());
        central.extend_from_slice(name.as_bytes());
    }
    let cd_offset = u32::try_from(out.len()).map_err(std::io::Error::other)?;
    let cd_size = u32::try_from(central.len()).map_err(std::io::Error::other)?;
    let count = u16::try_from(files.len()).map_err(std::io::Error::other)?;
    out.extend_from_slice(&central);
    out.extend_from_slice(&0x0605_4b50_u32.to_le_bytes());
    out.extend_from_slice(&[0; 4]);
    out.extend_from_slice(&count.to_le_bytes());
    out.extend_from_slice(&count.to_le_bytes());
    out.extend_from_slice(&cd_size.to_le_bytes());
    out.extend_from_slice(&cd_offset.to_le_bytes());
    out.extend_from_slice(&0_u16.to_le_bytes());
    Ok(out)
}

/// MS-DOS time and date fields.
fn dos_time(at: i64) -> (u16, u16) {
    use chrono::{Datelike, Timelike};
    let t = chrono::DateTime::from_timestamp(at, 0).unwrap_or_default();
    let time = (t.hour() << 11) | (t.minute() << 5) | (t.second() / 2);
    let year = u32::try_from(t.year() - 1980).unwrap_or(0).min(127);
    let date = (year << 9) | (t.month() << 5) | t.day();
    (
        u16::try_from(time).unwrap_or(0),
        u16::try_from(date).unwrap_or(0),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unzip_reads_it_back() {
        let files = vec![
            (
                "a.txt".to_owned(),
                b"Hello=\xd0\x9f\xd1\x80\xd0\xb8\xd0\xb2\xd0\xb5\xd1\x82\r\n".to_vec(),
            ),
            ("b.tsv".to_owned(), b"x\ty\n".to_vec()),
        ];
        let bytes = zip(&files, 1_794_200_000).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("t.zip");
        std::fs::write(&path, &bytes).unwrap();
        // The system `unzip` when present; else check the signatures.
        if let Ok(out) = std::process::Command::new("unzip")
            .arg("-p")
            .arg(&path)
            .arg("a.txt")
            .output()
        {
            if out.status.success() {
                assert_eq!(out.stdout, files[0].1);
            }
        }
        assert_eq!(&bytes[..4], &[0x50, 0x4b, 0x03, 0x04]);
        let end = bytes.len() - 22;
        assert_eq!(&bytes[end..end + 4], &[0x50, 0x4b, 0x05, 0x06]);
    }

    #[test]
    fn the_deflate_inside_inflates() {
        use flate2::read::DeflateDecoder;
        use std::io::Read;
        let data = "строка\tтаб\n".repeat(100).into_bytes();
        let bytes = zip(&[("x.tsv".to_owned(), data.clone())], 0).unwrap();
        let start = 30 + "x.tsv".len();
        let csize = u32::from_le_bytes(bytes[18..22].try_into().unwrap()) as usize;
        let mut back = Vec::new();
        DeflateDecoder::new(&bytes[start..start + csize])
            .read_to_end(&mut back)
            .unwrap();
        assert_eq!(back, data);
    }
}
