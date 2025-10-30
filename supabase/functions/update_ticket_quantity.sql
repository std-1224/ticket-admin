create or replace function update_ticket_quantity(
  p_ticket_type_id uuid,
  p_amount numeric
)
returns void
language plpgsql
as $$
begin
  -- Update the total_quantity in ticket_types
  update ticket_types
  set total_quantity = total_quantity - p_amount
  where id = p_ticket_type_id
  and total_quantity >= p_amount; -- Ensure we don't go negative
  
  -- If no rows were updated (not enough quantity), raise an exception
  if not found then
    raise exception 'Not enough tickets available';
  end if;
end;
$$;