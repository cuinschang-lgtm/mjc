# 管理员设置

专辑编辑能力由数据库表 `public.app_admins` 控制。

## 将某个用户设为管理员

1. 在 Supabase 控制台打开 SQL Editor。
2. 使用已登录用户的 `auth.users.id`（UUID），执行：

```sql
insert into public.app_admins (user_id)
values ('YOUR_USER_ID')
on conflict (user_id) do nothing;
```

完成后，该用户在专辑详情页会看到“编辑”按钮，并可通过 `PUT /api/album/:albumId` 更新专辑字段。

