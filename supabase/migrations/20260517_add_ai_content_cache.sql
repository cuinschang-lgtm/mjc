-- 添加 AI 生成内容的元数据字段
ALTER TABLE public.album_content_overrides
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracklist_json JSONB;

-- 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_album_content_overrides_ai
  ON public.album_content_overrides(is_ai_generated, ai_generated_at);

-- 添加注释
COMMENT ON COLUMN public.album_content_overrides.is_ai_generated IS '标识内容是否由 AI 生成';
COMMENT ON COLUMN public.album_content_overrides.ai_model IS '使用的 AI 模型名称（如 deepseek-chat）';
COMMENT ON COLUMN public.album_content_overrides.ai_generated_at IS 'AI 生成时间';
COMMENT ON COLUMN public.album_content_overrides.tracklist_json IS 'AI 生成的曲目列表 JSON';
