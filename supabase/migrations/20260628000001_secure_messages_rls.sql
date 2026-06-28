-- Messaging security hardening.
--
-- The `messages` table already had RLS enabled with two policies:
--   * INSERT — sender_id must equal auth.uid() (you can only send as yourself)
--   * SELECT — only the sender or recipient of a row may read it
--
-- This migration completes the model:
--   1. Recipients (and admins) may UPDATE a message — without this policy RLS
--      silently blocks the "mark as read" write, so unread counts never clear.
--   2. Admins may SELECT every message, so they can search/moderate any chat.
--   3. A trigger makes message content immutable: an UPDATE may only change
--      `status` / `read_at`. Body, participants and timestamps can never be
--      rewritten by anyone going through the API (defence in depth — a
--      recipient marking a message read cannot also tamper with its text).
--
-- Net effect: a conversation is readable/writable only by its two participants
-- and any admin; nobody (not even a participant) can alter what was said.

-- 1. Recipients can update their received messages (mark read); admins too.
DROP POLICY IF EXISTS "Recipients can update message read state" ON public.messages;
CREATE POLICY "Recipients can update message read state"
ON public.messages FOR UPDATE
USING (
  auth.uid() = recipient_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  auth.uid() = recipient_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

-- 2. Admins can read every message (chat search / moderation).
DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages"
ON public.messages FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

-- 3. Message content is immutable — only status / read_at may change on UPDATE.
CREATE OR REPLACE FUNCTION public.messages_prevent_content_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF new.sender_id    IS DISTINCT FROM old.sender_id
     OR new.recipient_id IS DISTINCT FROM old.recipient_id
     OR new.body         IS DISTINCT FROM old.body
     OR new.listing_id   IS DISTINCT FROM old.listing_id
     OR new.trade_id     IS DISTINCT FROM old.trade_id
     OR new.created_at   IS DISTINCT FROM old.created_at THEN
    RAISE EXCEPTION 'messages: only status and read_at may be updated';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS messages_prevent_content_change ON public.messages;
CREATE TRIGGER messages_prevent_content_change
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_prevent_content_change();
