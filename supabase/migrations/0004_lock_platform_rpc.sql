-- The platform-provided rls_auto_enable() is SECURITY DEFINER and exposed over /rest/v1/rpc.
-- Nothing in this app calls it, so it is not callable by API roles.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
