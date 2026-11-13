package vn.goihue;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.*;
import java.util.*;
import java.nio.file.*;
import java.io.*;
import javax.imageio.ImageIO;

@RestController
@RequestMapping("/api/v1")
public class CatalogApi {
    final CatalogService catalog;
    final PlatformApi app;
    final Path storage=Path.of("/data/catalog");
    public CatalogApi(CatalogService catalog,PlatformApi app){this.catalog=catalog;this.app=app;}
    @GetMapping("/categories") public Object categories(){return catalog.categories(false);}
    @GetMapping("/shipping") public Object shipping(){return catalog.shipping();}
    @GetMapping("/admin/categories") public Object categories(HttpServletRequest req){app.permission(app.actor(req),"catalog.manage");return catalog.categories(true);}
    @PutMapping(value="/catalog/images/{id}/content",consumes=MediaType.APPLICATION_OCTET_STREAM_VALUE) @Transactional
    public Object upload(@PathVariable String id,@RequestBody byte[] input,HttpServletRequest req) throws Exception{
        app.origin(req);app.lock();var a=app.actor(req);app.permission(a,"catalog.manage");var file=catalog.get(id,"catalog-image");app.require(input.length>0&&input.length<=5*1024*1024,"Ảnh tối đa 5 MB.");String digest=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(input));
        if(app.str(file,"status").equals("READY")){if(!digest.equals(file.get("digest")))throw new PlatformApi.Problem(409,"Ảnh đã hoàn tất với nội dung khác.");return Map.of("id",id,"image","/api/store/catalog/images/"+id);}
        try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(input))){var readers=ImageIO.getImageReaders(stream);app.require(readers.hasNext(),"Nội dung không phải ảnh hợp lệ.");var reader=readers.next();try{reader.setInput(stream);String format=reader.getFormatName().toLowerCase(Locale.ROOT);app.require(Set.of("png","jpeg","jpg").contains(format),"Chỉ nhận ảnh PNG/JPEG.");int w=reader.getWidth(0),h=reader.getHeight(0);app.require(w>0&&h>0&&w<=6000&&h<=6000&&(long)w*h<=16_000_000,"Ảnh tối đa 6000px mỗi chiều và 16 triệu pixel.");var image=reader.read(0);app.require(image!=null,"Không thể đọc nội dung ảnh.");Files.createDirectories(storage);Path temp=Files.createTempFile(storage,"upload-",".tmp");try{app.require(ImageIO.write(image,"png",temp.toFile()),"Không thể xử lý ảnh.");Files.move(temp,storage.resolve(id),StandardCopyOption.REPLACE_EXISTING);}finally{Files.deleteIfExists(temp);}}finally{reader.dispose();}}catch(javax.imageio.IIOException invalid){throw new PlatformApi.Problem(422,"Ảnh bị hỏng hoặc không thể đọc. Hãy chọn PNG/JPEG khác.");}
        file.put("status","READY");file.put("digest",digest);app.save("catalog-image",app.owner(id),file);app.audit(a,id,"CATALOG_IMAGE_UPLOADED");return Map.of("id",id,"image","/api/store/catalog/images/"+id);
    }
    @GetMapping("/catalog/images/{id}") public ResponseEntity<byte[]> image(@PathVariable String id,HttpServletRequest req) throws Exception{
        var file=catalog.get(id,"catalog-image");app.require(app.str(file,"status").equals("READY"),"Ảnh chưa sẵn sàng.");
        boolean visible=catalog.db.queryForObject("SELECT count(*) FROM records r WHERE data->>'imageId'=? AND data->>'active'='true' AND (kind='category' OR (kind='product' AND EXISTS(SELECT 1 FROM records c WHERE c.kind='category' AND c.data->>'code'=r.data->>'category' AND c.data->>'active'='true')))",Integer.class,id)>0;
        if(!visible)app.permission(app.actor(req),"catalog.manage");
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).header("Cache-Control","no-store").header("X-Content-Type-Options","nosniff").body(Files.readAllBytes(storage.resolve(id)));
    }
    @ExceptionHandler(Exception.class) public ResponseEntity<?> error(Exception e){return app.error(e);}
}
