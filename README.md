# Coleta de resultados dos simulados · URE Sumaré

Aplicação web responsiva baseada na pasta `Formulario_Coleta_Resultados_Simulados_URE_Sumare.xlsx`, conectada ao projeto Supabase `simulados` já existente.

## Recursos

- Login por e-mail e senha institucional e redefinição de senha por e-mail.
- Cadastro compartilhado de resultados no Supabase, com cálculos de ausências e participação.
- Dashboard regional, filtros por período, busca e exportação CSV.
- Importação do CSV exportado pelo protótipo anterior para transferir registros locais para a base compartilhada.
- Leitura regional para usuários autorizados; edição e exclusão apenas pelo autor do registro, aplicadas também no banco por Row Level Security (RLS).
- Nenhum nome ou identificador de estudante é solicitado.

## Acesso de usuários e administrador

Não há cadastro público. O administrador da organização deve criar ou convidar cada profissional no Supabase Dashboard em **Authentication → Users** e configurar a senha ou o convite enviado ao e-mail. As políticas do projeto autorizam e-mails dos domínios `educacao.sp.gov.br`, `professor.educacao.sp.gov.br` e `fde.sp.gov.br`.

Contas sem papel especial veem e alteram somente os próprios registros. A função de administrador é atribuída a uma conta existente na tabela `public.user_roles`; essa tabela não permite que usuários promovam a si mesmos. Depois de você informar o e-mail institucional que será o administrador, associe-o no Supabase SQL Editor com:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('EMAIL_INSTITUCIONAL_DO_ADMIN')
on conflict (user_id) do update set role = excluded.role;
```

O resultado precisa ser exatamente uma linha. O usuário deve sair e entrar novamente para a interface atualizar o papel. O administrador vê, edita e exclui registros de todos os usuários; os demais continuam restritos aos seus próprios registros.

No Supabase Dashboard, em **Authentication → URL Configuration**, configure a URL do site em **Site URL** e inclua a URL do site e a de desenvolvimento em **Redirect URLs**. Isso é necessário para o fluxo de recuperação de senha.

## Publicação

Sirva estes arquivos por HTTPS em um host de site estático (por exemplo, Cloudflare Pages, Netlify ou Vercel). O `index.html` é a entrada; mantenha `app.js`, `styles.css` e `auth.css` na mesma pasta. A biblioteca Supabase JS está fixada na versão `2.118.0` via CDN.

O navegador usa somente a chave publishable do projeto Supabase. Ela foi criada para uso no cliente; nunca coloque uma chave `service_role` ou secret neste site.

## Transferir dados do protótipo

1. No protótipo anterior, exporte os registros em CSV.
2. Publique e abra esta aplicação e entre com uma conta institucional autorizada.
3. Acesse **Registros → Importar CSV** e selecione o arquivo exportado.

Os registros importados passam a ser associados à conta que fez a importação. Essa conta poderá editar e excluir esses registros; os demais usuários autorizados poderão consultá-los.

## Segurança e operação

O banco possui RLS ativada e políticas explícitas para SELECT, INSERT, UPDATE e DELETE. As políticas não permitem acesso anônimo; a autenticação do cliente não substitui a proteção no banco. O projeto retornou um aviso para habilitar a proteção contra senhas comprometidas em **Authentication → Security and Protection** antes de liberar o uso amplo.

Configure também limites de tentativas de login, SMTP institucional se necessário e um processo para remover acessos quando profissionais deixarem a equipe. Evite dados pessoais de estudantes nos campos de texto livre.
