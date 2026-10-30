-- MarketHub database schema for Supabase PostgreSQL.
-- Run the entire file in Supabase Dashboard > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name varchar(80) not null check (char_length(trim(name)) between 2 and 80),
  email varchar(254) not null unique,
  password_hash text not null,
  role text not null check (role in ('customer', 'vendor')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles(id) on delete restrict,
  name varchar(120) not null check (char_length(trim(name)) between 2 and 120),
  description varchar(800) not null default '',
  category varchar(60) not null check (char_length(trim(category)) between 2 and 60),
  price numeric(12,2) not null check (price > 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  delivery_address varchar(300) not null check (char_length(trim(delivery_address)) between 8 and 300),
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  vendor_id uuid not null references public.profiles(id) on delete restrict,
  product_name varchar(120) not null,
  unit_price numeric(12,2) not null check (unit_price > 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored
);

create index if not exists products_active_category_idx on public.products(is_active, category);
create index if not exists products_vendor_idx on public.products(vendor_id);
create index if not exists orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_vendor_idx on public.order_items(vendor_id);

-- The application accesses the database through the Express server using the
-- service-role key, which bypasses RLS. Keep that key server-side only.
-- RLS is enabled as a defence-in-depth default; do not expose tables directly
-- through the Supabase browser client.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- No anon/authenticated policies are created because all application queries
-- go through the protected Express API. The service-role key must never reach
-- the browser. If you later add direct Supabase client access, design and test
-- policies before exposing any table.

create or replace function public.place_marketplace_order(
  p_customer_id uuid,
  p_delivery_address text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_count integer := 0;
begin
  if p_delivery_address is null or char_length(trim(p_delivery_address)) < 8 or char_length(p_delivery_address) > 300 then
    raise exception 'Please enter a valid delivery address.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'An order must contain between 1 and 30 product lines.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_customer_id and role = 'customer') then
    raise exception 'Customer account was not found.' using errcode = 'P0001';
  end if;

  insert into public.orders(customer_id, delivery_address, total)
  values (p_customer_id, trim(p_delivery_address), 0)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_count := v_count + 1;
    if v_item->>'product_id' is null or (v_item->>'quantity') is null then
      raise exception 'Each item must include product_id and quantity.' using errcode = 'P0001';
    end if;
    begin
      v_qty := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'Product quantity must be a whole number.' using errcode = 'P0001';
    end;
    if v_qty < 1 or v_qty > 100 then
      raise exception 'Product quantity must be from 1 to 100.' using errcode = 'P0001';
    end if;

    -- Lock the product row to prevent two concurrent orders overselling stock.
    select * into v_product from public.products
    where id = (v_item->>'product_id')::uuid and is_active = true
    for update;
    if not found then
      raise exception 'A selected product is no longer available.' using errcode = 'P0001';
    end if;
    if v_product.stock < v_qty then
      raise exception 'Not enough stock for product: %', v_product.name using errcode = 'P0001';
    end if;

    update public.products set stock = stock - v_qty where id = v_product.id;
    insert into public.order_items(order_id, product_id, vendor_id, product_name, unit_price, quantity)
    values (v_order_id, v_product.id, v_product.vendor_id, v_product.name, v_product.price, v_qty);
    v_total := v_total + (v_product.price * v_qty);
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  return jsonb_build_object('id', v_order_id, 'total', v_total, 'status', 'pending', 'item_count', v_count);
end;
$$;

-- Function is called only from the backend with its protected service-role key.
revoke all on function public.place_marketplace_order(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.place_marketplace_order(uuid, text, jsonb) to service_role;
