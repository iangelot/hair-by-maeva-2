-- Hair by Maeva 2 catalog additions and corrections.
-- Run this once in the hair-by-maeva-2 Supabase SQL editor.

insert into public.services (category_id,name,slug,description,notes,image_path,duration_minutes,display_order,is_active) values
((select id from public.service_categories where slug='twists'),'French Curly','french-curly','Soft curly braids with a romantic, textured finish.','Hair is not included.','assets/styles/french-curly-long.jpeg',240,4,true),
((select id from public.service_categories where slug='braids'),'Ponytail','ponytail','A sleek braided ponytail with a polished finish.','Hair is not included.','assets/styles/pony-tail.jpeg',180,5,true),
((select id from public.service_categories where slug='braids'),'Fulani Braids','fulani-braids','Detailed Fulani-inspired braids with clean patterning.','Boho hair is not included.','assets/styles/braid-parting.jpeg',240,6,true),
((select id from public.service_categories where slug='braids'),'Miracles Knotless Braids','miracles-knotless-braids','Lightweight knotless braids with a clean, protective finish.','Boho hair is not included.','assets/styles/long-box-braids.png',300,7,true),
((select id from public.service_categories where slug='braids'),'Box Braids','box-braids','Classic box braids tailored to your preferred length.','Boho hair is not included.','assets/styles/box-braids.png',300,8,true),
((select id from public.service_categories where slug='braids'),'Jumbo Knotless','jumbo-knotless','Bold, lightweight jumbo knotless braids.','Boho hair is not included.','assets/styles/long-box-braids.png',240,9,true),
((select id from public.service_categories where slug='braids'),'Small Knotless','small-knotless','Neat, versatile small knotless braids.','Boho hair is not included.','assets/styles/stitch-braids.jpeg',360,10,true),
((select id from public.service_categories where slug='braids'),'Medium Knotless','medium-knotless','Classic medium knotless braids for an effortless finish.','Boho hair is not included.','assets/styles/senegalese-twist.png',300,11,true),
((select id from public.service_categories where slug='braids'),'Xsmall Knotless','xsmall-knotless','Delicate extra-small knotless braids with maximum detail.','Boho hair is not included.','assets/styles/long-braids-ponytail.jpeg',420,12,true),
((select id from public.service_categories where slug='braids'),'Bora Bora Braids','bora-bora-braids','Statement braids with a soft, island-inspired finish.','Hair is not included.','assets/styles/curly-boho.png',360,13,true),
((select id from public.service_categories where slug='braids'),'Half Side Stitch Braid','half-side-stitch-braid','A half-side stitch braid with a soft curly finish.','Hair is not included.','assets/styles/half-side-stitch.jpeg',240,14,true),
((select id from public.service_categories where slug='twists'),'Micro Twist','micro-twist','Fine, detailed micro twists with a lightweight finish.','Hair is not included.','assets/styles/micro-twist.jpeg',360,15,true),
((select id from public.service_categories where slug='braids'),'Boho Knotless','boho-knotless','Knotless braids finished with soft, textured boho curls.','Boho hair is not included.','assets/styles/french-curly.jpeg',360,16,true)
on conflict (slug) do update set name=excluded.name,description=excluded.description,notes=excluded.notes,image_path=excluded.image_path,duration_minutes=excluded.duration_minutes,display_order=excluded.display_order,is_active=excluded.is_active;

update public.services set image_path='assets/styles/senegalese-twist.png',description='Detailed, long-lasting Senegalese twists tailored to you.',notes='Boho hair is not included.' where slug='senegalese-twist';

insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Bob',200,1),('Middle',230,2),('Waist',260,3),('Butt',300,4)) x(name,price,display_order) where s.slug in ('senegalese-twist','box-braids') on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Medium',200,1),('Small',250,2),('Xsmall',300,3)) x(name,price,display_order) where s.slug='french-curly' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Bob',230,1),('Middle',250,2),('Waist',270,3),('Butt',330,4)) x(name,price,display_order) where s.slug='boho-knotless' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Medium',180,1),('Small',220,2),('Xsmall',250,3)) x(name,price,display_order) where s.slug='miracles-knotless-braids' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Bob',120,1),('Middle',150,2),('Waist',200,3),('Butt',220,4)) x(name,price,display_order) where s.slug='jumbo-knotless' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Bob',200,1),('Middle',220,2),('Waist',260,3),('Butt',300,4)) x(name,price,display_order) where s.slug='small-knotless' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Bob',180,1),('Middle',200,2),('Waist',230,3),('Butt',260,4)) x(name,price,display_order) where s.slug='medium-knotless' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Bob',220,1),('Middle',250,2),('Waist',300,3),('Butt',350,4)) x(name,price,display_order) where s.slug='xsmall-knotless' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Medium',250,1),('Small',300,2),('Xsmall',350,3)) x(name,price,display_order) where s.slug='bora-bora-braids' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Stitch braid',220,1),('Regular braids',180,2)) x(name,price,display_order) where s.slug='ponytail' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Stitch braid',220,1),('Regular braids',200,2)) x(name,price,display_order) where s.slug='fulani-braids' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Half side stitch braid',220,1)) x(name,price,display_order) where s.slug='half-side-stitch-braid' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
insert into public.service_lengths(service_id,name,price,display_order)
select s.id,x.name,x.price,x.display_order from public.services s cross join (values ('Micro twist',300,1)) x(name,price,display_order) where s.slug='micro-twist' on conflict(service_id,name) do update set price=excluded.price,display_order=excluded.display_order;
delete from public.service_options where service_id in (select id from public.services where slug in ('ponytail','fulani-braids'));
delete from public.service_lengths where service_id in (select id from public.services where slug in ('ponytail','fulani-braids')) and name='Standard';
