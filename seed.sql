-- DEVELOPMENT SAMPLE DATA ONLY. Change/remove these PINs before production use.
insert into departments(name) values ('Fabrication'),('Assembly'),('Finishing'),('Engineering'),('Shipping') on conflict do nothing;

insert into employees(employee_code,full_name,department_id,role,pin_hash)
select 'E1001','John Smith',id,'employee',crypt('1234',gen_salt('bf')) from departments where name='Fabrication'
on conflict(employee_code) do nothing;
insert into employees(employee_code,full_name,department_id,role,pin_hash)
select 'S1001','Sarah Supervisor',id,'supervisor',crypt('2468',gen_salt('bf')) from departments where name='Fabrication'
on conflict(employee_code) do nothing;
insert into employees(employee_code,full_name,department_id,role,pin_hash)
select 'A1001','Mastercraft Admin',id,'admin',crypt('8642',gen_salt('bf')) from departments where name='Engineering'
on conflict(employee_code) do nothing;

insert into jobs(job_number,customer_name,description,due_date,priority,status)
values ('MC-26042','ABC Manufacturing','Bracket Assembly',current_date+7,2,'in_progress'),
       ('MC-26051','ABC Manufacturing','Frame Assembly',current_date+10,3,'not_started')
on conflict(job_number) do nothing;

insert into operations(job_id,department_id,operation_name,sequence_no,estimated_hours,status)
select j.id,d.id,'Fabrication',1,6,'ready' from jobs j cross join departments d where j.job_number='MC-26042' and d.name='Fabrication'
on conflict(job_id,sequence_no) do nothing;
insert into operations(job_id,department_id,operation_name,sequence_no,estimated_hours,status)
select j.id,d.id,'Fabrication',1,3.5,'queued' from jobs j cross join departments d where j.job_number='MC-26051' and d.name='Fabrication'
on conflict(job_id,sequence_no) do nothing;

insert into assignments(operation_id,employee_id)
select o.id,e.id from operations o join jobs j on j.id=o.job_id cross join employees e where j.job_number in ('MC-26042','MC-26051') and e.employee_code='E1001'
on conflict(operation_id,employee_id) do nothing;

insert into materials(item_code,description,unit_of_measure,standard_cost) values
('AL-0125-4896','Aluminum Sheet 0.125 x 48 x 96','sheet',125.00),
('ST-1X1-083','Steel Tube 1 x 1 x 0.083','ft',3.75),
('KIT-A12','Hardware Kit A12','ea',18.50),
('PC-BLK','Powder Coat - Black','lb',6.25)
on conflict(item_code) do nothing;
