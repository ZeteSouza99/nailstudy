-- Mantém os cadastros anteriores como arquivo, sem apagar histórico financeiro
-- nem alterar horários de atendimentos que já foram registrados.
INSERT INTO professionals (id, name, role, phone, email, color, work_days)
VALUES ('pro-001', 'Erika Queiroz', 'Nail Designer', '', '', '#83423e', ARRAY['Seg','Ter','Qua','Qui','Sex','Sáb'])
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
UPDATE professionals SET active = false WHERE id <> 'pro-001';
--> statement-breakpoint
UPDATE professionals SET name = 'Erika Queiroz', role = 'Nail Designer',
  phone = '', email = '', specialties = ARRAY[]::text[], color = '#83423e',
  active = true, commission_rate_bps = 0 WHERE id = 'pro-001';
--> statement-breakpoint
INSERT INTO professional_services (professional_id, service_id)
SELECT 'pro-001', id FROM services ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE schedule_blocks SET professional_id = NULL;
