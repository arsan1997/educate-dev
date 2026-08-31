-- Stock / Inventory module migration
-- Run this once in Supabase Dashboard > SQL Editor.

create table if not exists public.inventory_items (
  id text primary key,
  name text not null,
  category text not null default 'other',
  robot_type text,
  power_type text,
  field_type text,
  unit text not null default 'ชิ้น',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.inventory_items(id,name,category,robot_type,power_type,field_type,unit,sort_order) values
  ('code-go-battery','Code & Go แบบถ่าน','robot','Code & Go','battery',null,'ตัว',10),
  ('code-go-charge','Code & Go แบบชาร์จ','robot','Code & Go','rechargeable',null,'ตัว',20),
  ('botley-battery','Botley','robot','Botley','battery',null,'ตัว',30),
  ('botzees-charge','Botzees','robot','Botzees','rechargeable',null,'ตัว',40),
  ('mbot2-charge','Mbot2','robot','Mbot2','rechargeable',null,'ตัว',50),
  ('aa-battery','ถ่าน AA','consumable',null,'battery',null,'ก้อน',60),
  ('code-go-battery-charger','ที่ชาร์จถ่าน Code & Go','accessory','Code & Go','battery',null,'เครื่อง',70),
  ('botley-battery-charger','ที่ชาร์จถ่าน Botley','accessory','Botley','battery',null,'เครื่อง',75),
  ('code-go-charge-cable','สายชาร์จ Code & Go','accessory','Code & Go','rechargeable',null,'เส้น',80),
  ('botzees-charge-cable','สายชาร์จ Botzees','accessory','Botzees','rechargeable',null,'เส้น',85),
  ('mbot2-charge-cable','สายชาร์จ Mbot2','accessory','Mbot2','rechargeable',null,'เส้น',88),
  ('tablet','แท็บเล็ต','accessory',null,'rechargeable',null,'เครื่อง',90),
  ('field-code-go-vinyl','สนาม Code & Go ไวนิล','field','Code & Go',null,'vinyl','ชุด',100),
  ('field-code-go-mousepad','สนาม Code & Go แผ่นรองเมาส์','field','Code & Go',null,'mousepad','ชุด',110),
  ('field-botley-vinyl','สนาม Botley ไวนิล','field','Botley',null,'vinyl','ชุด',120),
  ('field-botley-mousepad','สนาม Botley แผ่นรองเมาส์','field','Botley',null,'mousepad','ชุด',130),
  ('field-botzees-vinyl','สนาม Botzees ไวนิล','field','Botzees',null,'vinyl','ชุด',140),
  ('field-botzees-mousepad','สนาม Botzees แผ่นรองเมาส์','field','Botzees',null,'mousepad','ชุด',150),
  ('field-mbot2-vinyl','สนาม Mbot2 ไวนิล','field','Mbot2',null,'vinyl','ชุด',160),
  ('field-mbot2-mousepad','สนาม Mbot2 แผ่นรองเมาส์','field','Mbot2',null,'mousepad','ชุด',170),
  ('field-vinyl','สนามไวนิล (ยังไม่ระบุหุ่น)','field',null,null,'vinyl','ชุด',900),
  ('field-mousepad','สนามแผ่นรองเมาส์ (ยังไม่ระบุหุ่น)','field',null,null,'mousepad','ชุด',910),
  ('battery-charger','ที่ชาร์จถ่าน (ยังไม่ระบุหุ่น)','accessory',null,null,null,'เครื่อง',920),
  ('charge-cable','สายชาร์จ (ยังไม่ระบุหุ่น)','accessory',null,'rechargeable',null,'เส้น',930)
on conflict(id) do update set
  name=excluded.name,
  category=excluded.category,
  robot_type=excluded.robot_type,
  power_type=excluded.power_type,
  field_type=excluded.field_type,
  unit=excluded.unit,
  sort_order=excluded.sort_order,
  active=true;

create table if not exists public.office_inventory (
  office_id text not null references public.offices(id) on delete cascade,
  item_id text not null references public.inventory_items(id) on delete cascade,
  quantity integer not null default 0 check(quantity >= 0),
  usable_quantity integer not null default 0 check(usable_quantity >= 0),
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(office_id,item_id)
);

create table if not exists public.school_inventory (
  school_id text not null references public.schools(id) on delete cascade,
  item_id text not null references public.inventory_items(id) on delete cascade,
  quantity integer not null default 0 check(quantity >= 0),
  usable_quantity integer not null default 0 check(usable_quantity >= 0),
  notes text not null default '',
  checked_at date,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(school_id,item_id)
);

create index if not exists office_inventory_item_idx on public.office_inventory(item_id);
create index if not exists school_inventory_item_idx on public.school_inventory(item_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('checkout','return','grant_to_school')),
  item_id text not null references public.inventory_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  from_owner_type text check (from_owner_type in ('office','school','event')),
  from_owner_id text,
  to_owner_type text check (to_owner_type in ('office','school','event')),
  to_owner_id text,
  related_school_id text references public.schools(id) on delete set null,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_created_idx on public.stock_movements(created_at desc);
create index if not exists stock_movements_item_idx on public.stock_movements(item_id);
create index if not exists stock_movements_from_idx on public.stock_movements(from_owner_type,from_owner_id);
create index if not exists stock_movements_to_idx on public.stock_movements(to_owner_type,to_owner_id);

create or replace function public.apply_stock_movement(
  p_movement_type text,
  p_item_id text,
  p_quantity integer,
  p_from_office_id text default null,
  p_to_office_id text default null,
  p_school_id text default null,
  p_note text default ''
)
returns public.stock_movements
language plpgsql
security definer
set search_path=public
as $$
declare
  movement public.stock_movements%rowtype;
  target_owner_type text;
  target_owner_id text;
  source_owner_type text;
  source_owner_id text;
  affected_rows integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero';
  end if;

  if p_movement_type not in ('checkout','return','grant_to_school') then
    raise exception 'invalid movement type';
  end if;

  if not exists(select 1 from public.profiles where id=auth.uid() and role in ('super_admin','school_admin')) then
    raise exception 'permission denied';
  end if;

  if not exists(select 1 from public.inventory_items where id=p_item_id and active=true) then
    raise exception 'invalid item';
  end if;

  if p_movement_type in ('checkout','grant_to_school') then
    if coalesce(p_from_office_id,'') = '' then
      raise exception 'from office is required';
    end if;

    update public.office_inventory
    set quantity=quantity-p_quantity,
        usable_quantity=usable_quantity-p_quantity,
        updated_by=auth.uid(),
        updated_at=now()
    where office_id=p_from_office_id
      and item_id=p_item_id
      and quantity>=p_quantity
      and usable_quantity>=p_quantity;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'not enough stock in source office';
    end if;

    source_owner_type := 'office';
    source_owner_id := p_from_office_id;
  end if;

  if p_movement_type='checkout' then
    target_owner_type := 'event';
    target_owner_id := coalesce(p_school_id, p_from_office_id);
  elsif p_movement_type='return' then
    if coalesce(p_to_office_id,'') = '' then
      raise exception 'to office is required';
    end if;

    insert into public.office_inventory(office_id,item_id,quantity,usable_quantity,updated_by,updated_at)
    values(p_to_office_id,p_item_id,p_quantity,p_quantity,auth.uid(),now())
    on conflict(office_id,item_id) do update set
      quantity=public.office_inventory.quantity+excluded.quantity,
      usable_quantity=public.office_inventory.usable_quantity+excluded.usable_quantity,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;

    source_owner_type := 'event';
    source_owner_id := coalesce(p_school_id, p_to_office_id);
    target_owner_type := 'office';
    target_owner_id := p_to_office_id;
  elsif p_movement_type='grant_to_school' then
    if coalesce(p_school_id,'') = '' then
      raise exception 'school is required';
    end if;

    insert into public.school_inventory(school_id,item_id,quantity,usable_quantity,checked_at,updated_by,updated_at)
    values(p_school_id,p_item_id,p_quantity,p_quantity,current_date,auth.uid(),now())
    on conflict(school_id,item_id) do update set
      quantity=public.school_inventory.quantity+excluded.quantity,
      usable_quantity=public.school_inventory.usable_quantity+excluded.usable_quantity,
      checked_at=excluded.checked_at,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;

    target_owner_type := 'school';
    target_owner_id := p_school_id;
  end if;

  insert into public.stock_movements(
    movement_type,item_id,quantity,
    from_owner_type,from_owner_id,
    to_owner_type,to_owner_id,
    related_school_id,note,created_by
  ) values (
    p_movement_type,p_item_id,p_quantity,
    source_owner_type,source_owner_id,
    target_owner_type,target_owner_id,
    nullif(p_school_id,''),coalesce(p_note,''),auth.uid()
  )
  returning * into movement;

  return movement;
end;
$$;

alter table public.inventory_items enable row level security;
alter table public.office_inventory enable row level security;
alter table public.school_inventory enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists "inventory_items_select" on public.inventory_items;
drop policy if exists "inventory_items_write" on public.inventory_items;
drop policy if exists "office_inventory_select" on public.office_inventory;
drop policy if exists "office_inventory_write" on public.office_inventory;
drop policy if exists "school_inventory_select" on public.school_inventory;
drop policy if exists "school_inventory_write" on public.school_inventory;
drop policy if exists "stock_movements_select" on public.stock_movements;
drop policy if exists "stock_movements_insert" on public.stock_movements;

create policy "inventory_items_select"
on public.inventory_items
for select
using (exists(select 1 from public.profiles where id=auth.uid() and role<>'pending'));

create policy "inventory_items_write"
on public.inventory_items
for all
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "office_inventory_select"
on public.office_inventory
for select
using (exists(select 1 from public.profiles where id=auth.uid() and role<>'pending'));

create policy "office_inventory_write"
on public.office_inventory
for all
using (
  public.is_super_admin()
  or exists(select 1 from public.profiles where id=auth.uid() and role='school_admin')
)
with check (
  public.is_super_admin()
  or exists(select 1 from public.profiles where id=auth.uid() and role='school_admin')
);

create policy "school_inventory_select"
on public.school_inventory
for select
using (public.can_access_school(school_id));

create policy "school_inventory_write"
on public.school_inventory
for all
using (public.can_edit_school(school_id))
with check (public.can_edit_school(school_id));

create policy "stock_movements_select"
on public.stock_movements
for select
using (exists(select 1 from public.profiles where id=auth.uid() and role<>'pending'));

grant select,insert,update,delete on public.inventory_items to authenticated;
grant select,insert,update,delete on public.office_inventory to authenticated;
grant select,insert,update,delete on public.school_inventory to authenticated;
revoke insert,update,delete on public.stock_movements from authenticated;
grant select on public.stock_movements to authenticated;
grant execute on function public.apply_stock_movement(text,text,integer,text,text,text,text) to authenticated;

notify pgrst, 'reload schema';
