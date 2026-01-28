-- Trigger, der beim Erstellen eines Nutzers (Auth) automatisch ein Profil anlegt
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
