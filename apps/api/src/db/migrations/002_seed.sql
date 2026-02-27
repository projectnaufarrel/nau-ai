-- Insert KM ITB organization
INSERT INTO organizations (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'KM ITB', 'Keluarga Mahasiswa Institut Teknologi Bandung')
ON CONFLICT DO NOTHING;

-- Insert sample documents
INSERT INTO documents (id, org_id, title, doc_type)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'AD/ART KM ITB 2024', 'constitution'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Panduan Kepanitiaan 2024', 'guide'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'FAQ Kegiatan Kemahasiswaan', 'faq')
ON CONFLICT DO NOTHING;

-- Insert document sections (search_vector auto-populated by trigger)
INSERT INTO document_sections (document_id, section_title, content, section_order)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Pasal 1 — Nama dan Kedudukan',
   'KM ITB adalah organisasi kemahasiswaan yang berkedudukan di Institut Teknologi Bandung dan berfungsi sebagai wadah kegiatan mahasiswa.', 1),

  ('10000000-0000-0000-0000-000000000001', 'Pasal 5 — Keanggotaan',
   'Anggota KM ITB adalah seluruh mahasiswa aktif Institut Teknologi Bandung yang terdaftar pada semester berjalan.', 2),

  ('10000000-0000-0000-0000-000000000001', 'Pasal 12 — Prosedur Pengajuan Kegiatan',
   'Pengajuan kegiatan dilakukan minimal 14 hari sebelum pelaksanaan. Proposal harus mencantumkan tujuan, anggaran, dan penanggung jawab kegiatan.', 3),

  ('10000000-0000-0000-0000-000000000002', 'Bab 1 — Pendahuluan',
   'Panduan kepanitiaan ini bertujuan memberikan acuan bagi panitia penyelenggara kegiatan mahasiswa di lingkungan KM ITB.', 1),

  ('10000000-0000-0000-0000-000000000002', 'Bab 3 — Timeline Kegiatan',
   'Timeline kegiatan harus disusun H-30 sebelum acara. Rapat koordinasi wajib dilakukan minimal dua kali sebelum pelaksanaan.', 2),

  ('10000000-0000-0000-0000-000000000002', 'Bab 4 — Anggaran dan Sponsorship',
   'Anggaran kegiatan harus disetujui oleh Bendahara KM ITB. Sponsorship eksternal harus melewati seleksi dan persetujuan dari Presiden KM ITB.', 3),

  ('10000000-0000-0000-0000-000000000003', 'FAQ — Cara Mendaftar Kepanitiaan',
   'Untuk mendaftar kepanitiaan, mahasiswa dapat mengisi formulir open recruitment yang dibuka oleh masing-masing badan otonom atau unit kegiatan mahasiswa.', 1),

  ('10000000-0000-0000-0000-000000000003', 'FAQ — Apa itu Kabinet KM ITB',
   'Kabinet KM ITB adalah kelompok kerja yang dipimpin oleh Presiden KM ITB. Kabinet bertugas menjalankan program kerja sesuai visi-misi yang telah ditetapkan.', 2),

  ('10000000-0000-0000-0000-000000000003', 'FAQ — Prosedur Peminjaman Ruangan',
   'Peminjaman ruangan dilakukan melalui sistem online di portal akademik ITB. Permohonan harus diajukan minimal 3 hari kerja sebelum penggunaan.', 3),

  ('10000000-0000-0000-0000-000000000003', 'FAQ — Beasiswa dan Bantuan Dana',
   'KM ITB mengelola program beasiswa melalui Dana Kesejahteraan Mahasiswa. Pendaftaran dibuka setiap semester melalui website resmi KM ITB.', 4);
