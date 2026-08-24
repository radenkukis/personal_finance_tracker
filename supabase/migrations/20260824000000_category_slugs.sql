-- =====================================================================
--  Kategori bawaan mendapat slug, supaya namanya bisa ikut bahasa user.
--
--  Sampai sekarang nama kategori tersimpan sebagai teks biasa dalam bahasa
--  saat akun dibuat. Ganti bahasa antarmuka ke Jerman, dan isinya tetap
--  "Makan & Minum" — setengah aplikasi berpindah bahasa, setengahnya tidak.
--
--  Slug memecahkan itu tanpa menerjemahkan apa pun saat berjalan: nama yang
--  tampil diambil dari kamus di aplikasi, bukan dari kolom name. Gratis,
--  seketika, dan hasilnya sama setiap kali.
--
--  Kategori buatan user sendiri TIDAK punya slug, jadi namanya tetap seperti
--  yang dia ketik. Itu memang seharusnya — itu katanya, bukan kata kami.
--  Begitu pula kalau dia mengganti nama kategori bawaan: slug-nya dilepas,
--  dan sejak saat itu kategorinya menjadi miliknya.
-- =====================================================================
alter table public.categories add column if not exists slug text;

comment on column public.categories.slug is
  'Kategori bawaan: kunci nama di kamus i18n. NULL berarti nama milik user.';

-- ---------------------------------------------------------------------
--  Isi ulang untuk akun yang sudah ada.
--
--  Kecocokan sengaja ketat — nama, jenis, warna, DAN urutan harus sama
--  persis dengan yang pernah disemai. Mencocokkan nama saja akan menyambar
--  kategori buatan user yang kebetulan bernama "Transport", lalu namanya
--  berubah sendiri ketika dia mengganti bahasa.
-- ---------------------------------------------------------------------

update public.categories set slug = 'food_drink'
  where slug is null and name = 'Food & Drink' and kind = 'expense' and color = '#FF8A5B' and sort_order = 10;
update public.categories set slug = 'transport'
  where slug is null and name = 'Transport' and kind = 'expense' and color = '#5B9BFF' and sort_order = 20;
update public.categories set slug = 'shopping'
  where slug is null and name = 'Shopping' and kind = 'expense' and color = '#C084FC' and sort_order = 30;
update public.categories set slug = 'bills'
  where slug is null and name = 'Bills' and kind = 'expense' and color = '#FFB74D' and sort_order = 40;
update public.categories set slug = 'health'
  where slug is null and name = 'Health' and kind = 'expense' and color = '#4ADE80' and sort_order = 50;
update public.categories set slug = 'entertainment'
  where slug is null and name = 'Entertainment' and kind = 'expense' and color = '#F472B6' and sort_order = 60;
update public.categories set slug = 'education'
  where slug is null and name = 'Education' and kind = 'expense' and color = '#38BDF8' and sort_order = 70;
update public.categories set slug = 'home'
  where slug is null and name = 'Home' and kind = 'expense' and color = '#A3A3A3' and sort_order = 80;
update public.categories set slug = 'social'
  where slug is null and name = 'Social' and kind = 'expense' and color = '#FB7185' and sort_order = 90;
update public.categories set slug = 'other'
  where slug is null and name = 'Other' and kind = 'expense' and color = '#8A97A6' and sort_order = 999;
update public.categories set slug = 'salary'
  where slug is null and name = 'Salary' and kind = 'income' and color = '#22D3A6' and sort_order = 10;
update public.categories set slug = 'freelance'
  where slug is null and name = 'Freelance' and kind = 'income' and color = '#22D3A6' and sort_order = 20;
update public.categories set slug = 'other_income'
  where slug is null and name = 'Other income' and kind = 'income' and color = '#22D3A6' and sort_order = 30;
update public.categories set slug = 'food_drink'
  where slug is null and name = 'Makan & Minum' and kind = 'expense' and color = '#FF8A5B' and sort_order = 10;
update public.categories set slug = 'shopping'
  where slug is null and name = 'Belanja' and kind = 'expense' and color = '#C084FC' and sort_order = 30;
update public.categories set slug = 'bills'
  where slug is null and name = 'Tagihan' and kind = 'expense' and color = '#FFB74D' and sort_order = 40;
update public.categories set slug = 'health'
  where slug is null and name = 'Kesehatan' and kind = 'expense' and color = '#4ADE80' and sort_order = 50;
update public.categories set slug = 'entertainment'
  where slug is null and name = 'Hiburan' and kind = 'expense' and color = '#F472B6' and sort_order = 60;
update public.categories set slug = 'education'
  where slug is null and name = 'Pendidikan' and kind = 'expense' and color = '#38BDF8' and sort_order = 70;
update public.categories set slug = 'home'
  where slug is null and name = 'Rumah' and kind = 'expense' and color = '#A3A3A3' and sort_order = 80;
update public.categories set slug = 'social'
  where slug is null and name = 'Sosial' and kind = 'expense' and color = '#FB7185' and sort_order = 90;
update public.categories set slug = 'other'
  where slug is null and name = 'Lainnya' and kind = 'expense' and color = '#8A97A6' and sort_order = 999;
update public.categories set slug = 'salary'
  where slug is null and name = 'Gaji' and kind = 'income' and color = '#22D3A6' and sort_order = 10;
update public.categories set slug = 'other_income'
  where slug is null and name = 'Pemasukan Lain' and kind = 'income' and color = '#22D3A6' and sort_order = 30;
update public.categories set slug = 'food_drink'
  where slug is null and name = '餐饮' and kind = 'expense' and color = '#FF8A5B' and sort_order = 10;
update public.categories set slug = 'transport'
  where slug is null and name = '交通' and kind = 'expense' and color = '#5B9BFF' and sort_order = 20;
update public.categories set slug = 'shopping'
  where slug is null and name = '购物' and kind = 'expense' and color = '#C084FC' and sort_order = 30;
update public.categories set slug = 'bills'
  where slug is null and name = '账单' and kind = 'expense' and color = '#FFB74D' and sort_order = 40;
update public.categories set slug = 'health'
  where slug is null and name = '医疗' and kind = 'expense' and color = '#4ADE80' and sort_order = 50;
update public.categories set slug = 'entertainment'
  where slug is null and name = '娱乐' and kind = 'expense' and color = '#F472B6' and sort_order = 60;
update public.categories set slug = 'education'
  where slug is null and name = '教育' and kind = 'expense' and color = '#38BDF8' and sort_order = 70;
update public.categories set slug = 'home'
  where slug is null and name = '居家' and kind = 'expense' and color = '#A3A3A3' and sort_order = 80;
update public.categories set slug = 'social'
  where slug is null and name = '人情' and kind = 'expense' and color = '#FB7185' and sort_order = 90;
update public.categories set slug = 'other'
  where slug is null and name = '其他' and kind = 'expense' and color = '#8A97A6' and sort_order = 999;
update public.categories set slug = 'salary'
  where slug is null and name = '工资' and kind = 'income' and color = '#22D3A6' and sort_order = 10;
update public.categories set slug = 'freelance'
  where slug is null and name = '自由职业' and kind = 'income' and color = '#22D3A6' and sort_order = 20;
update public.categories set slug = 'other_income'
  where slug is null and name = '其他收入' and kind = 'income' and color = '#22D3A6' and sort_order = 30;
update public.categories set slug = 'food_drink'
  where slug is null and name = '餐飲' and kind = 'expense' and color = '#FF8A5B' and sort_order = 10;
update public.categories set slug = 'shopping'
  where slug is null and name = '購物' and kind = 'expense' and color = '#C084FC' and sort_order = 30;
update public.categories set slug = 'bills'
  where slug is null and name = '帳單' and kind = 'expense' and color = '#FFB74D' and sort_order = 40;
update public.categories set slug = 'health'
  where slug is null and name = '醫療' and kind = 'expense' and color = '#4ADE80' and sort_order = 50;
update public.categories set slug = 'entertainment'
  where slug is null and name = '娛樂' and kind = 'expense' and color = '#F472B6' and sort_order = 60;
update public.categories set slug = 'salary'
  where slug is null and name = '薪水' and kind = 'income' and color = '#22D3A6' and sort_order = 10;
update public.categories set slug = 'freelance'
  where slug is null and name = '自由工作' and kind = 'income' and color = '#22D3A6' and sort_order = 20;
update public.categories set slug = 'food_drink'
  where slug is null and name = '食費' and kind = 'expense' and color = '#FF8A5B' and sort_order = 10;
update public.categories set slug = 'shopping'
  where slug is null and name = '買い物' and kind = 'expense' and color = '#C084FC' and sort_order = 30;
update public.categories set slug = 'bills'
  where slug is null and name = '固定費' and kind = 'expense' and color = '#FFB74D' and sort_order = 40;
update public.categories set slug = 'health'
  where slug is null and name = '医療' and kind = 'expense' and color = '#4ADE80' and sort_order = 50;
update public.categories set slug = 'entertainment'
  where slug is null and name = '娯楽' and kind = 'expense' and color = '#F472B6' and sort_order = 60;
update public.categories set slug = 'home'
  where slug is null and name = '住まい' and kind = 'expense' and color = '#A3A3A3' and sort_order = 80;
update public.categories set slug = 'social'
  where slug is null and name = '交際費' and kind = 'expense' and color = '#FB7185' and sort_order = 90;
update public.categories set slug = 'other'
  where slug is null and name = 'その他' and kind = 'expense' and color = '#8A97A6' and sort_order = 999;
update public.categories set slug = 'salary'
  where slug is null and name = '給料' and kind = 'income' and color = '#22D3A6' and sort_order = 10;
update public.categories set slug = 'freelance'
  where slug is null and name = 'フリーランス' and kind = 'income' and color = '#22D3A6' and sort_order = 20;
update public.categories set slug = 'other_income'
  where slug is null and name = 'その他の収入' and kind = 'income' and color = '#22D3A6' and sort_order = 30;
update public.categories set slug = 'food_drink'
  where slug is null and name = '식비' and kind = 'expense' and color = '#FF8A5B' and sort_order = 10;
update public.categories set slug = 'transport'
  where slug is null and name = '교통' and kind = 'expense' and color = '#5B9BFF' and sort_order = 20;
update public.categories set slug = 'shopping'
  where slug is null and name = '쇼핑' and kind = 'expense' and color = '#C084FC' and sort_order = 30;
update public.categories set slug = 'bills'
  where slug is null and name = '공과금' and kind = 'expense' and color = '#FFB74D' and sort_order = 40;
update public.categories set slug = 'health'
  where slug is null and name = '의료' and kind = 'expense' and color = '#4ADE80' and sort_order = 50;
update public.categories set slug = 'entertainment'
  where slug is null and name = '여가' and kind = 'expense' and color = '#F472B6' and sort_order = 60;
update public.categories set slug = 'education'
  where slug is null and name = '교육' and kind = 'expense' and color = '#38BDF8' and sort_order = 70;
update public.categories set slug = 'home'
  where slug is null and name = '주거' and kind = 'expense' and color = '#A3A3A3' and sort_order = 80;
update public.categories set slug = 'social'
  where slug is null and name = '경조사' and kind = 'expense' and color = '#FB7185' and sort_order = 90;
update public.categories set slug = 'other'
  where slug is null and name = '기타' and kind = 'expense' and color = '#8A97A6' and sort_order = 999;
update public.categories set slug = 'salary'
  where slug is null and name = '급여' and kind = 'income' and color = '#22D3A6' and sort_order = 10;
update public.categories set slug = 'freelance'
  where slug is null and name = '프리랜서' and kind = 'income' and color = '#22D3A6' and sort_order = 20;
update public.categories set slug = 'other_income'
  where slug is null and name = '기타 수입' and kind = 'income' and color = '#22D3A6' and sort_order = 30;
update public.categories set slug = 'food_drink'
  where slug is null and name = 'Comida y bebida' and kind = 'expense' and color = '#FF8A5B' and sort_order = 10;
update public.categories set slug = 'transport'
  where slug is null and name = 'Transporte' and kind = 'expense' and color = '#5B9BFF' and sort_order = 20;
update public.categories set slug = 'shopping'
  where slug is null and name = 'Compras' and kind = 'expense' and color = '#C084FC' and sort_order = 30;
update public.categories set slug = 'bills'
  where slug is null and name = 'Facturas' and kind = 'expense' and color = '#FFB74D' and sort_order = 40;
update public.categories set slug = 'health'
  where slug is null and name = 'Salud' and kind = 'expense' and color = '#4ADE80' and sort_order = 50;
update public.categories set slug = 'entertainment'
  where slug is null and name = 'Ocio' and kind = 'expense' and color = '#F472B6' and sort_order = 60;
update public.categories set slug = 'education'
  where slug is null and name = 'Educación' and kind = 'expense' and color = '#38BDF8' and sort_order = 70;
update public.categories set slug = 'home'
  where slug is null and name = 'Hogar' and kind = 'expense' and color = '#A3A3A3' and sort_order = 80;
update public.categories set slug = 'other'
  where slug is null and name = 'Otros' and kind = 'expense' and color = '#8A97A6' and sort_order = 999;
update public.categories set slug = 'salary'
  where slug is null and name = 'Salario' and kind = 'income' and color = '#22D3A6' and sort_order = 10;
update public.categories set slug = 'other_income'
  where slug is null and name = 'Otros ingresos' and kind = 'income' and color = '#22D3A6' and sort_order = 30;
update public.categories set slug = 'food_drink'
  where slug is null and name = 'Alimentation' and kind = 'expense' and color = '#FF8A5B' and sort_order = 10;
update public.categories set slug = 'shopping'
  where slug is null and name = 'Achats' and kind = 'expense' and color = '#C084FC' and sort_order = 30;
update public.categories set slug = 'bills'
  where slug is null and name = 'Factures' and kind = 'expense' and color = '#FFB74D' and sort_order = 40;
update public.categories set slug = 'health'
  where slug is null and name = 'Santé' and kind = 'expense' and color = '#4ADE80' and sort_order = 50;
update public.categories set slug = 'entertainment'
  where slug is null and name = 'Loisirs' and kind = 'expense' and color = '#F472B6' and sort_order = 60;
update public.categories set slug = 'education'
  where slug is null and name = 'Éducation' and kind = 'expense' and color = '#38BDF8' and sort_order = 70;
update public.categories set slug = 'home'
  where slug is null and name = 'Maison' and kind = 'expense' and color = '#A3A3A3' and sort_order = 80;
update public.categories set slug = 'other'
  where slug is null and name = 'Autres' and kind = 'expense' and color = '#8A97A6' and sort_order = 999;
update public.categories set slug = 'salary'
  where slug is null and name = 'Salaire' and kind = 'income' and color = '#22D3A6' and sort_order = 10;
update public.categories set slug = 'other_income'
  where slug is null and name = 'Autres revenus' and kind = 'income' and color = '#22D3A6' and sort_order = 30;
update public.categories set slug = 'food_drink'
  where slug is null and name = 'Essen & Trinken' and kind = 'expense' and color = '#FF8A5B' and sort_order = 10;
update public.categories set slug = 'shopping'
  where slug is null and name = 'Einkaufen' and kind = 'expense' and color = '#C084FC' and sort_order = 30;
update public.categories set slug = 'bills'
  where slug is null and name = 'Rechnungen' and kind = 'expense' and color = '#FFB74D' and sort_order = 40;
update public.categories set slug = 'health'
  where slug is null and name = 'Gesundheit' and kind = 'expense' and color = '#4ADE80' and sort_order = 50;
update public.categories set slug = 'entertainment'
  where slug is null and name = 'Freizeit' and kind = 'expense' and color = '#F472B6' and sort_order = 60;
update public.categories set slug = 'education'
  where slug is null and name = 'Bildung' and kind = 'expense' and color = '#38BDF8' and sort_order = 70;
update public.categories set slug = 'home'
  where slug is null and name = 'Wohnen' and kind = 'expense' and color = '#A3A3A3' and sort_order = 80;
update public.categories set slug = 'social'
  where slug is null and name = 'Soziales' and kind = 'expense' and color = '#FB7185' and sort_order = 90;
update public.categories set slug = 'other'
  where slug is null and name = 'Sonstiges' and kind = 'expense' and color = '#8A97A6' and sort_order = 999;
update public.categories set slug = 'salary'
  where slug is null and name = 'Gehalt' and kind = 'income' and color = '#22D3A6' and sort_order = 10;
update public.categories set slug = 'other_income'
  where slug is null and name = 'Sonstige Einnahmen' and kind = 'income' and color = '#22D3A6' and sort_order = 30;
update public.categories set slug = 'food_drink'
  where slug is null and name = 'Makan & Minum' and kind = 'expense' and color = '#FF8A5B' and sort_order = 10;
update public.categories set slug = 'other_income'
  where slug is null and name = 'Pemasukan Lain' and kind = 'income' and color = '#22D3A6' and sort_order = 30;

-- ---------------------------------------------------------------------
--  Fungsi semai ditulis ulang agar ikut menuliskan slug.
-- ---------------------------------------------------------------------
create or replace function public.seed_starter_categories(uid uuid, lang text)
returns void
language plpgsql
security definer set search_path = public
as $seed$
begin
  case lang

  when 'en' then
    insert into public.categories (user_id, name, kind, icon, color, keywords, sort_order, slug) values
      (uid, 'Food & Drink', 'expense', 'food', '#FF8A5B', array['food','drink','lunch','dinner','breakfast','coffee','cafe','restaurant','groceries','snack','takeaway','pizza','burger','tea','beer','brunch'], 10, 'food_drink'),
      (uid, 'Transport', 'expense', 'car', '#5B9BFF', array['fuel','gas','petrol','uber','lyft','taxi','cab','bus','train','metro','subway','parking','toll','flight','airfare'], 20, 'transport'),
      (uid, 'Shopping', 'expense', 'cart', '#C084FC', array['shopping','amazon','clothes','shoes','shirt','jeans','jacket','bag','cosmetics','skincare','electronics','gadget'], 30, 'shopping'),
      (uid, 'Bills', 'expense', 'receipt', '#FFB74D', array['electricity','water','internet','wifi','phone','mobile','subscription','netflix','spotify','insurance','bill','utilities'], 40, 'bills'),
      (uid, 'Health', 'expense', 'health', '#4ADE80', array['doctor','pharmacy','medicine','hospital','clinic','dentist','vitamins','checkup','therapy','prescription'], 50, 'health'),
      (uid, 'Entertainment', 'expense', 'game', '#F472B6', array['cinema','movie','game','steam','concert','museum','bar','club','holiday','trip','streaming'], 60, 'entertainment'),
      (uid, 'Education', 'expense', 'book', '#38BDF8', array['course','tuition','book','class','school','university','udemy','seminar','training','workshop'], 70, 'education'),
      (uid, 'Home', 'expense', 'home', '#A3A3A3', array['rent','furniture','ikea','repair','cleaning','detergent','soap','kitchen','tools','garden'], 80, 'home'),
      (uid, 'Social', 'expense', 'gift', '#FB7185', array['gift','present','donation','charity','wedding','birthday','treat'], 90, 'social'),
      (uid, 'Other', 'expense', 'tag', '#8A97A6', array[]::text[], 999, 'other'),
      (uid, 'Salary', 'income', 'wallet', '#22D3A6', array['salary','payroll','wage','paycheck','bonus'], 10, 'salary'),
      (uid, 'Freelance', 'income', 'laptop', '#22D3A6', array['freelance','project','invoice','fee','commission','client'], 20, 'freelance'),
      (uid, 'Other income', 'income', 'plus', '#22D3A6', array['refund','cashback','prize','dividend','interest','sold'], 30, 'other_income');

  when 'id' then
    insert into public.categories (user_id, name, kind, icon, color, keywords, sort_order, slug) values
      (uid, 'Makan & Minum', 'expense', 'food', '#FF8A5B', array['makan','minum','warteg','nasi','ayam','bakso','mie','sate','padang','resto','restoran','cafe','kopi','ngopi','starbucks','gofood','grabfood','shopeefood','jajan','sarapan','lunch','dinner','snack','martabak','seblak','boba','geprek','soto'], 10, 'food_drink'),
      (uid, 'Transport', 'expense', 'car', '#5B9BFF', array['bensin','pertamax','pertalite','solar','gojek','grab','maxim','ojek','ojol','taksi','busway','transjakarta','krl','mrt','kereta','parkir','tol','etoll','angkot','oli','pesawat'], 20, 'transport'),
      (uid, 'Belanja', 'expense', 'cart', '#C084FC', array['belanja','indomaret','alfamart','supermarket','superindo','hypermart','tokopedia','shopee','lazada','tiktokshop','baju','sepatu','celana','skincare','kosmetik','tas'], 30, 'shopping'),
      (uid, 'Tagihan', 'expense', 'receipt', '#FFB74D', array['listrik','pln','pdam','air','internet','wifi','indihome','pulsa','kuota','bpjs','asuransi','netflix','spotify','langganan','iuran','cicilan'], 40, 'bills'),
      (uid, 'Kesehatan', 'expense', 'health', '#4ADE80', array['dokter','obat','apotek','apotik','rumah','sakit','klinik','vitamin','periksa','lab','gigi'], 50, 'health'),
      (uid, 'Hiburan', 'expense', 'game', '#F472B6', array['nonton','bioskop','cgv','xxi','game','steam','konser','tiket','liburan','wisata','karaoke'], 60, 'entertainment'),
      (uid, 'Pendidikan', 'expense', 'book', '#38BDF8', array['kuliah','spp','buku','kursus','les','seminar','pelatihan','udemy','sekolah'], 70, 'education'),
      (uid, 'Rumah', 'expense', 'home', '#A3A3A3', array['kos','kost','sewa','kontrakan','perabot','ikea','galon','gas','lpg','sabun','deterjen','peralatan'], 80, 'home'),
      (uid, 'Sosial', 'expense', 'gift', '#FB7185', array['kado','hadiah','sumbangan','donasi','zakat','sedekah','nikahan','kondangan','angpao','traktir','patungan'], 90, 'social'),
      (uid, 'Lainnya', 'expense', 'tag', '#8A97A6', array[]::text[], 999, 'other'),
      (uid, 'Gaji', 'income', 'wallet', '#22D3A6', array['gaji','gajian','salary','payroll','thr','bonus'], 10, 'salary'),
      (uid, 'Freelance', 'income', 'laptop', '#22D3A6', array['freelance','project','proyek','fee','honor','komisi'], 20, 'freelance'),
      (uid, 'Pemasukan Lain', 'income', 'plus', '#22D3A6', array['refund','cashback','hadiah','menang','jual','dividen','bunga'], 30, 'other_income');

  when 'zh-Hans' then
    insert into public.categories (user_id, name, kind, icon, color, keywords, sort_order, slug) values
      (uid, '餐饮', 'expense', 'food', '#FF8A5B', array['吃饭','午餐','晚餐','早餐','咖啡','外卖','奶茶','零食','饭'], 10, 'food_drink'),
      (uid, '交通', 'expense', 'car', '#5B9BFF', array['加油','打车','地铁','公交','高铁','停车','过路费','机票'], 20, 'transport'),
      (uid, '购物', 'expense', 'cart', '#C084FC', array['购物','淘宝','京东','拼多多','衣服','鞋','包','化妆品'], 30, 'shopping'),
      (uid, '账单', 'expense', 'receipt', '#FFB74D', array['电费','水费','燃气','宽带','话费','房租','会员','保险'], 40, 'bills'),
      (uid, '医疗', 'expense', 'health', '#4ADE80', array['看病','药','药店','医院','诊所','牙科','体检'], 50, 'health'),
      (uid, '娱乐', 'expense', 'game', '#F472B6', array['电影','游戏','演唱会','旅游','景点','酒吧','KTV'], 60, 'entertainment'),
      (uid, '教育', 'expense', 'book', '#38BDF8', array['学费','书','课程','培训','考试','辅导'], 70, 'education'),
      (uid, '居家', 'expense', 'home', '#A3A3A3', array['房租','家具','维修','清洁','日用品','厨房'], 80, 'home'),
      (uid, '人情', 'expense', 'gift', '#FB7185', array['送礼','红包','捐款','婚礼','生日','请客'], 90, 'social'),
      (uid, '其他', 'expense', 'tag', '#8A97A6', array[]::text[], 999, 'other'),
      (uid, '工资', 'income', 'wallet', '#22D3A6', array['工资','薪水','奖金','年终奖'], 10, 'salary'),
      (uid, '自由职业', 'income', 'laptop', '#22D3A6', array['兼职','项目','稿费','佣金'], 20, 'freelance'),
      (uid, '其他收入', 'income', 'plus', '#22D3A6', array['退款','返现','利息','分红','二手'], 30, 'other_income');

  when 'zh-Hant' then
    insert into public.categories (user_id, name, kind, icon, color, keywords, sort_order, slug) values
      (uid, '餐飲', 'expense', 'food', '#FF8A5B', array['吃飯','午餐','晚餐','早餐','咖啡','外送','奶茶','零食'], 10, 'food_drink'),
      (uid, '交通', 'expense', 'car', '#5B9BFF', array['加油','計程車','捷運','公車','高鐵','停車','過路費','機票'], 20, 'transport'),
      (uid, '購物', 'expense', 'cart', '#C084FC', array['購物','網購','衣服','鞋','包','化妝品','超商'], 30, 'shopping'),
      (uid, '帳單', 'expense', 'receipt', '#FFB74D', array['電費','水費','瓦斯','網路','電話費','房租','會員','保險'], 40, 'bills'),
      (uid, '醫療', 'expense', 'health', '#4ADE80', array['看醫','藥','藥局','醫院','診所','牙科','健檢'], 50, 'health'),
      (uid, '娛樂', 'expense', 'game', '#F472B6', array['電影','遊戲','演唱會','旅行','景點','酒吧'], 60, 'entertainment'),
      (uid, '教育', 'expense', 'book', '#38BDF8', array['學費','書','課程','培訓','考試','補習'], 70, 'education'),
      (uid, '居家', 'expense', 'home', '#A3A3A3', array['房租','家具','維修','清潔','日用品','廚房'], 80, 'home'),
      (uid, '人情', 'expense', 'gift', '#FB7185', array['送禮','紅包','捐款','婚禮','生日','請客'], 90, 'social'),
      (uid, '其他', 'expense', 'tag', '#8A97A6', array[]::text[], 999, 'other'),
      (uid, '薪水', 'income', 'wallet', '#22D3A6', array['薪水','工資','獎金','年終獎'], 10, 'salary'),
      (uid, '自由工作', 'income', 'laptop', '#22D3A6', array['兼職','專案','稿費','佣金'], 20, 'freelance'),
      (uid, '其他收入', 'income', 'plus', '#22D3A6', array['退款','現金回饋','利息','股息','二手'], 30, 'other_income');

  when 'ja' then
    insert into public.categories (user_id, name, kind, icon, color, keywords, sort_order, slug) values
      (uid, '食費', 'expense', 'food', '#FF8A5B', array['ランチ','夕食','朝食','コーヒー','外食','コンビニ','スーパー','酒'], 10, 'food_drink'),
      (uid, '交通', 'expense', 'car', '#5B9BFF', array['ガソリン','電車','バス','タクシー','新幹線','駐車場','高速','航空券'], 20, 'transport'),
      (uid, '買い物', 'expense', 'cart', '#C084FC', array['買い物','アマゾン','楽天','服','靴','カバン','化粧品','家電'], 30, 'shopping'),
      (uid, '固定費', 'expense', 'receipt', '#FFB74D', array['電気代','水道代','ガス代','ネット','携帯','家賫','サブスク','保険'], 40, 'bills'),
      (uid, '医療', 'expense', 'health', '#4ADE80', array['病院','薬','薬局','クリニック','歯科','健診'], 50, 'health'),
      (uid, '娯楽', 'expense', 'game', '#F472B6', array['映画','ゲーム','ライブ','旅行','カラオケ','バー'], 60, 'entertainment'),
      (uid, '教育', 'expense', 'book', '#38BDF8', array['学費','本','講座','塵','資格','セミナー'], 70, 'education'),
      (uid, '住まい', 'expense', 'home', '#A3A3A3', array['家賫','家具','修理','洗剤','日用品','キッチン'], 80, 'home'),
      (uid, '交際費', 'expense', 'gift', '#FB7185', array['プレゼント','ご祝儀','寄付','結婚式','誕生日','飲み会'], 90, 'social'),
      (uid, 'その他', 'expense', 'tag', '#8A97A6', array[]::text[], 999, 'other'),
      (uid, '給料', 'income', 'wallet', '#22D3A6', array['給料','給与','賞与','ボーナス'], 10, 'salary'),
      (uid, 'フリーランス', 'income', 'laptop', '#22D3A6', array['副業','案件','原稿料','報酬'], 20, 'freelance'),
      (uid, 'その他の収入', 'income', 'plus', '#22D3A6', array['返金','キャッシュバック','利息','配当','メルカリ'], 30, 'other_income');

  when 'ko' then
    insert into public.categories (user_id, name, kind, icon, color, keywords, sort_order, slug) values
      (uid, '식비', 'expense', 'food', '#FF8A5B', array['점심','저녁','아침','커피','배달','편의점','술','카페'], 10, 'food_drink'),
      (uid, '교통', 'expense', 'car', '#5B9BFF', array['주유','지하철','버스','택시','KTX','주차','통행료','항공권'], 20, 'transport'),
      (uid, '쇼핑', 'expense', 'cart', '#C084FC', array['쇼핑','쿠팡','옳','신발','가방','화장품','가전'], 30, 'shopping'),
      (uid, '공과금', 'expense', 'receipt', '#FFB74D', array['전기요금','수도요금','가스','인터넷','통신비','월세','구독','보험'], 40, 'bills'),
      (uid, '의료', 'expense', 'health', '#4ADE80', array['병원','약','약국','의원','치과','건강검진'], 50, 'health'),
      (uid, '여가', 'expense', 'game', '#F472B6', array['영화','게임','공연','여행','노래방','술집'], 60, 'entertainment'),
      (uid, '교육', 'expense', 'book', '#38BDF8', array['등록금','책','강의','학원','자격증','세미나'], 70, 'education'),
      (uid, '주거', 'expense', 'home', '#A3A3A3', array['월세','가구','수리','청소','생필품','주방'], 80, 'home'),
      (uid, '경조사', 'expense', 'gift', '#FB7185', array['선물','축의금','기부','결혼식','생일','회식'], 90, 'social'),
      (uid, '기타', 'expense', 'tag', '#8A97A6', array[]::text[], 999, 'other'),
      (uid, '급여', 'income', 'wallet', '#22D3A6', array['월급','급여','상여금','보너스'], 10, 'salary'),
      (uid, '프리랜서', 'income', 'laptop', '#22D3A6', array['부업','프로젝트','원고료','수수료'], 20, 'freelance'),
      (uid, '기타 수입', 'income', 'plus', '#22D3A6', array['환불','캐시백','이자','배당','중고'], 30, 'other_income');

  when 'es' then
    insert into public.categories (user_id, name, kind, icon, color, keywords, sort_order, slug) values
      (uid, 'Comida y bebida', 'expense', 'food', '#FF8A5B', array['comida','almuerzo','cena','desayuno','café','restaurante','supermercado','mercado','bar','cerveza','tapas','menu'], 10, 'food_drink'),
      (uid, 'Transporte', 'expense', 'car', '#5B9BFF', array['gasolina','combustible','taxi','uber','cabify','metro','autobús','tren','parking','peaje','vuelo','billete'], 20, 'transport'),
      (uid, 'Compras', 'expense', 'cart', '#C084FC', array['compras','ropa','zapatos','camiseta','bolso','cosmética','amazon','electrónica'], 30, 'shopping'),
      (uid, 'Facturas', 'expense', 'receipt', '#FFB74D', array['luz','electricidad','agua','gas','internet','móvil','teléfono','alquiler','suscripción','netflix','spotify','seguro'], 40, 'bills'),
      (uid, 'Salud', 'expense', 'health', '#4ADE80', array['médico','farmacia','medicina','hospital','clínica','dentista','vitaminas'], 50, 'health'),
      (uid, 'Ocio', 'expense', 'game', '#F472B6', array['cine','película','juego','concierto','museo','viaje','vacaciones','bar','discoteca'], 60, 'entertainment'),
      (uid, 'Educación', 'expense', 'book', '#38BDF8', array['curso','matrícula','libro','clase','universidad','academia','seminario'], 70, 'education'),
      (uid, 'Hogar', 'expense', 'home', '#A3A3A3', array['alquiler','muebles','ikea','reparación','limpieza','detergente','jabón','cocina'], 80, 'home'),
      (uid, 'Social', 'expense', 'gift', '#FB7185', array['regalo','donación','boda','cumpleaños','invitar'], 90, 'social'),
      (uid, 'Otros', 'expense', 'tag', '#8A97A6', array[]::text[], 999, 'other'),
      (uid, 'Salario', 'income', 'wallet', '#22D3A6', array['salario','nómina','sueldo','paga','bonus'], 10, 'salary'),
      (uid, 'Freelance', 'income', 'laptop', '#22D3A6', array['freelance','proyecto','factura','honorarios','comisión','cliente'], 20, 'freelance'),
      (uid, 'Otros ingresos', 'income', 'plus', '#22D3A6', array['reembolso','cashback','premio','dividendo','intereses','venta'], 30, 'other_income');

  when 'fr' then
    insert into public.categories (user_id, name, kind, icon, color, keywords, sort_order, slug) values
      (uid, 'Alimentation', 'expense', 'food', '#FF8A5B', array['repas','déjeuner','dîner','petit-déjeuner','café','restaurant','courses','supermarché','boulangerie','bar','bière'], 10, 'food_drink'),
      (uid, 'Transport', 'expense', 'car', '#5B9BFF', array['essence','carburant','taxi','uber','métro','bus','train','parking','péage','vol','billet'], 20, 'transport'),
      (uid, 'Achats', 'expense', 'cart', '#C084FC', array['achats','vêtements','chaussures','sac','cosmétiques','amazon','électronique'], 30, 'shopping'),
      (uid, 'Factures', 'expense', 'receipt', '#FFB74D', array['électricité','eau','gaz','internet','mobile','téléphone','loyer','abonnement','netflix','spotify','assurance'], 40, 'bills'),
      (uid, 'Santé', 'expense', 'health', '#4ADE80', array['médecin','pharmacie','médicament','hôpital','clinique','dentiste','vitamines'], 50, 'health'),
      (uid, 'Loisirs', 'expense', 'game', '#F472B6', array['cinéma','film','jeu','concert','musée','voyage','vacances','bar'], 60, 'entertainment'),
      (uid, 'Éducation', 'expense', 'book', '#38BDF8', array['cours','frais','livre','école','université','formation','séminaire'], 70, 'education'),
      (uid, 'Maison', 'expense', 'home', '#A3A3A3', array['loyer','meubles','ikea','réparation','ménage','lessive','savon','cuisine'], 80, 'home'),
      (uid, 'Social', 'expense', 'gift', '#FB7185', array['cadeau','don','mariage','anniversaire','invitation'], 90, 'social'),
      (uid, 'Autres', 'expense', 'tag', '#8A97A6', array[]::text[], 999, 'other'),
      (uid, 'Salaire', 'income', 'wallet', '#22D3A6', array['salaire','paie','prime','bonus'], 10, 'salary'),
      (uid, 'Freelance', 'income', 'laptop', '#22D3A6', array['freelance','projet','facture','honoraires','commission','client'], 20, 'freelance'),
      (uid, 'Autres revenus', 'income', 'plus', '#22D3A6', array['remboursement','cashback','prix','dividende','intérêts','vente'], 30, 'other_income');

  when 'de' then
    insert into public.categories (user_id, name, kind, icon, color, keywords, sort_order, slug) values
      (uid, 'Essen & Trinken', 'expense', 'food', '#FF8A5B', array['essen','mittagessen','abendessen','frühstück','kaffee','restaurant','lebensmittel','supermarkt','bäckerei','bier','imbiss'], 10, 'food_drink'),
      (uid, 'Transport', 'expense', 'car', '#5B9BFF', array['benzin','tanken','taxi','uber','bahn','bus','zug','parken','maut','flug','ticket'], 20, 'transport'),
      (uid, 'Einkaufen', 'expense', 'cart', '#C084FC', array['einkaufen','kleidung','schuhe','hemd','tasche','kosmetik','amazon','elektronik'], 30, 'shopping'),
      (uid, 'Rechnungen', 'expense', 'receipt', '#FFB74D', array['strom','wasser','gas','internet','handy','telefon','miete','abo','netflix','spotify','versicherung'], 40, 'bills'),
      (uid, 'Gesundheit', 'expense', 'health', '#4ADE80', array['arzt','apotheke','medikament','krankenhaus','klinik','zahnarzt','vitamine'], 50, 'health'),
      (uid, 'Freizeit', 'expense', 'game', '#F472B6', array['kino','film','spiel','konzert','museum','urlaub','reise','bar'], 60, 'entertainment'),
      (uid, 'Bildung', 'expense', 'book', '#38BDF8', array['kurs','studiengebühr','buch','schule','universität','seminar','fortbildung'], 70, 'education'),
      (uid, 'Wohnen', 'expense', 'home', '#A3A3A3', array['miete','möbel','ikea','reparatur','reinigung','waschmittel','seife','küche'], 80, 'home'),
      (uid, 'Soziales', 'expense', 'gift', '#FB7185', array['geschenk','spende','hochzeit','geburtstag','einladen'], 90, 'social'),
      (uid, 'Sonstiges', 'expense', 'tag', '#8A97A6', array[]::text[], 999, 'other'),
      (uid, 'Gehalt', 'income', 'wallet', '#22D3A6', array['gehalt','lohn','gehälter','bonus','prämie'], 10, 'salary'),
      (uid, 'Freelance', 'income', 'laptop', '#22D3A6', array['freelance','projekt','rechnung','honorar','provision','kunde'], 20, 'freelance'),
      (uid, 'Sonstige Einnahmen', 'income', 'plus', '#22D3A6', array['rückerstattung','cashback','gewinn','dividende','zinsen','verkauf'], 30, 'other_income');

  else
    perform public.seed_starter_categories(uid, 'en');
  end case;
end;
$seed$;

-- ---------------------------------------------------------------------
--  Mengganti nama kategori bawaan menjadikannya milik user: slug dilepas.
--  Ditegakkan di database, bukan hanya di aplikasi, supaya perubahan lewat
--  jalur mana pun tetap konsisten.
-- ---------------------------------------------------------------------
create or replace function public.drop_slug_on_rename()
returns trigger
language plpgsql
as $fn$
begin
  if new.slug is not null and new.name is distinct from old.name then
    new.slug := null;
  end if;
  return new;
end;
$fn$;

drop trigger if exists categories_drop_slug_on_rename on public.categories;
create trigger categories_drop_slug_on_rename
  before update on public.categories
  for each row execute function public.drop_slug_on_rename();
