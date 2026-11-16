package vn.goihue;

import javax.imageio.ImageIO;
import javax.imageio.IIOException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Set;

final class PackingPhoto {
    private PackingPhoto() { }

    static byte[] normalize(byte[] input) throws IOException {
        if (input.length == 0 || input.length > 5 * 1024 * 1024)
            throw new PlatformApi.Problem(422, "Ảnh live-packing tối đa 5 MB.");
        try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(input))) {
            if (stream == null) throw invalid();
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw invalid();
            var reader = readers.next();
            try {
                if (!Set.of("PNG", "JPEG").contains(reader.getFormatName().toUpperCase(java.util.Locale.ROOT)))
                    throw invalid();
                reader.setInput(stream, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || width > 4096 || height > 4096
                        || (long) width * height > 4_000_000)
                    throw new PlatformApi.Problem(422, "Ảnh live-packing tối đa 4 triệu pixel.");
                var image = reader.read(0);
                var output = new ByteArrayOutputStream();
                if (image == null || !ImageIO.write(image, "png", output)) throw invalid();
                if (output.size() > 10 * 1024 * 1024)
                    throw new PlatformApi.Problem(422, "Ảnh sau xử lý quá lớn. Hãy chọn ảnh nhỏ hơn.");
                return output.toByteArray();
            } finally {
                reader.dispose();
            }
        } catch (IIOException corrupt) {
            throw invalid();
        }
    }

    private static PlatformApi.Problem invalid() {
        return new PlatformApi.Problem(422, "Ảnh live-packing phải là PNG hoặc JPEG hợp lệ.");
    }
}
