revoke execute on function public.request_join_ride(uuid, uuid, text[]) from public, anon;
revoke execute on function public.commit_to_ride(uuid, uuid, text[]) from public, anon;

grant execute on function public.request_join_ride(uuid, uuid, text[]) to authenticated;
grant execute on function public.commit_to_ride(uuid, uuid, text[]) to authenticated;
