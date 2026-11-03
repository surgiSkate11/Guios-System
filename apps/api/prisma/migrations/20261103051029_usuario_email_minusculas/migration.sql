-- Emails are stored lowercased (login and sign-up normalize them); enforce it.
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_email_minusculas_check" CHECK ("email" = lower("email"));
