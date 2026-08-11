-- Extend the shared trade/category enum with certificate-issuing trades so
-- compliance contractors (gas engineers, fire safety firms, EPC/legionella
-- assessors) fit the suppliers directory. New values are appended; existing
-- rows are untouched.
alter type maintenance_job_category add value if not exists 'gas_heating';
alter type maintenance_job_category add value if not exists 'fire_safety';
alter type maintenance_job_category add value if not exists 'inspection';
