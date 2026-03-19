use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sha2::{Digest, Sha256};

/// Convert raw DIB (BITMAPINFOHEADER + pixels) data to PNG bytes.
pub fn dib_to_png(dib: &[u8]) -> Result<Vec<u8>, String> {
    // BITMAPINFOHEADER is at least 40 bytes
    if dib.len() < 40 {
        return Err("DIB data too small".into());
    }

    let width = i32::from_le_bytes(dib[4..8].try_into().unwrap());
    let height = i32::from_le_bytes(dib[8..12].try_into().unwrap());
    let bit_count = u16::from_le_bytes(dib[14..16].try_into().unwrap());

    if width <= 0 || width > 16384 || height.unsigned_abs() > 16384 {
        return Err(format!("Invalid DIB dimensions: {width}x{height}"));
    }

    // Only support 24-bit and 32-bit DIBs
    if bit_count != 24 && bit_count != 32 {
        return Err(format!("Unsupported bit count: {bit_count}"));
    }

    let header_size = u32::from_le_bytes(dib[0..4].try_into().unwrap()) as usize;
    let abs_height = height.unsigned_abs() as u32;
    let is_bottom_up = height > 0;

    let bytes_per_pixel = (bit_count / 8) as usize;
    let row_size = ((width as usize * bytes_per_pixel + 3) / 4) * 4; // padded to 4 bytes
    let pixel_data = &dib[header_size..];

    let mut imgbuf = image::RgbaImage::new(width as u32, abs_height);

    for y in 0..abs_height {
        let src_y = if is_bottom_up { abs_height - 1 - y } else { y };
        let row_offset = src_y as usize * row_size;

        for x in 0..width as u32 {
            let px_offset = row_offset + x as usize * bytes_per_pixel;
            if px_offset + bytes_per_pixel > pixel_data.len() {
                break;
            }

            let b = pixel_data[px_offset];
            let g = pixel_data[px_offset + 1];
            let r = pixel_data[px_offset + 2];
            let a = if bytes_per_pixel == 4 {
                pixel_data[px_offset + 3]
            } else {
                255
            };

            imgbuf.put_pixel(x, y, image::Rgba([r, g, b, a]));
        }
    }

    let mut png_bytes = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
    image::ImageEncoder::write_image(
        encoder,
        imgbuf.as_raw(),
        width as u32,
        abs_height,
        image::ExtendedColorType::Rgba8,
    )
    .map_err(|e| e.to_string())?;

    Ok(png_bytes)
}

/// Encode PNG bytes as a base64 data URI string.
pub fn png_to_base64(png: &[u8]) -> String {
    STANDARD.encode(png)
}

/// Hash raw image bytes (for deduplication).
pub fn hash_image(data: &[u8]) -> String {
    let digest = Sha256::digest(data);
    format!("{digest:x}")
}

/// Convert PNG bytes back to raw DIB (BITMAPINFOHEADER + pixel data) for clipboard.
pub fn png_to_dib(png_bytes: &[u8]) -> Result<Vec<u8>, String> {
    let img = image::load_from_memory_with_format(png_bytes, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to decode PNG: {e}"))?;
    let rgba = img.to_rgba8();
    let width = rgba.width();
    let height = rgba.height();

    let bytes_per_pixel: u32 = 4; // BGRA
    let row_size = ((width * bytes_per_pixel + 3) / 4) * 4; // padded to 4 bytes
    let pixel_data_size = row_size * height;
    let header_size: u32 = 40; // BITMAPINFOHEADER

    let mut dib = Vec::with_capacity((header_size + pixel_data_size) as usize);

    // BITMAPINFOHEADER (40 bytes)
    dib.extend_from_slice(&header_size.to_le_bytes());       // biSize
    dib.extend_from_slice(&(width as i32).to_le_bytes());    // biWidth
    dib.extend_from_slice(&(height as i32).to_le_bytes());   // biHeight (positive = bottom-up)
    dib.extend_from_slice(&1u16.to_le_bytes());              // biPlanes
    dib.extend_from_slice(&32u16.to_le_bytes());             // biBitCount
    dib.extend_from_slice(&0u32.to_le_bytes());              // biCompression (BI_RGB)
    dib.extend_from_slice(&pixel_data_size.to_le_bytes());   // biSizeImage
    dib.extend_from_slice(&0i32.to_le_bytes());              // biXPelsPerMeter
    dib.extend_from_slice(&0i32.to_le_bytes());              // biYPelsPerMeter
    dib.extend_from_slice(&0u32.to_le_bytes());              // biClrUsed
    dib.extend_from_slice(&0u32.to_le_bytes());              // biClrImportant

    // Pixel data: bottom-up, BGRA order
    for y in (0..height).rev() {
        for x in 0..width {
            let pixel = rgba.get_pixel(x, y);
            dib.push(pixel[2]); // B
            dib.push(pixel[1]); // G
            dib.push(pixel[0]); // R
            dib.push(pixel[3]); // A
        }
        // Pad row to 4-byte boundary (already aligned for 32-bit, but be safe)
        let padding = (row_size - width * bytes_per_pixel) as usize;
        for _ in 0..padding {
            dib.push(0);
        }
    }

    Ok(dib)
}

/// Maximum image size to store (2 MB of raw DIB).
pub const MAX_IMAGE_BYTES: usize = 2 * 1024 * 1024;
