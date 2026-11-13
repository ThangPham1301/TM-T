INSERT INTO records(id,kind,owner_id,data)
SELECT id::uuid,'category',NULL,jsonb_build_object('id',id,'code',code,'name',name,'description','','image','/images/product-placeholder.svg','sortOrder',sort_order,'active',true,'revision',1,'createdAt',now()::text)
FROM (VALUES
 ('00000000-0000-4000-8000-000000000501','me-xung-keo-hue','Mè xửng Huế',1),
 ('00000000-0000-4000-8000-000000000502','banh-cung-dinh','Bánh cung đình',2),
 ('00000000-0000-4000-8000-000000000503','tra-cung-dinh','Trà Huế',3),
 ('00000000-0000-4000-8000-000000000504','qua-bieu','Quà biếu',4)
) AS seed(id,code,name,sort_order);
INSERT INTO records(id,kind,owner_id,data) VALUES ('00000000-0000-4000-8000-000000000600','settings',NULL,
 '{"id":"00000000-0000-4000-8000-000000000600","code":"shipping","baseFee":30000,"freeShippingThreshold":0,"enabled":true,"revision":1}');
CREATE UNIQUE INDEX unique_product_slug ON records((data->>'slug')) WHERE kind='product';
CREATE UNIQUE INDEX unique_category_code ON records((data->>'code')) WHERE kind='category';
UPDATE records SET data=data || jsonb_build_object('revision',1,'version',id::text,'createdAt',created_at::text) WHERE kind='cart';
INSERT INTO records(id,kind,owner_id,data)
SELECT '00000000-0000-4000-8000-000000000601','system',NULL,'{"id":"00000000-0000-4000-8000-000000000601","code":"catalog-initialized"}'::jsonb
WHERE EXISTS(SELECT 1 FROM records WHERE kind='product');
