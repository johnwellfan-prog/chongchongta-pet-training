const express = require('express');
const cors = require('cors');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Config
const BASE_TOKEN = 'OhW6bKTqja59ums3Y6Pc9madnsb';
const TABLE_ID = 'tblN1bXLKi7ofnrj';

// Field IDs in order for the rows format
const FIELD_IDS = [
  'fldKYH0LLl',  // 姓名
  'fldmDepI9v',  // 手机号
  'fldp9WZNKx',  // 培训得分
  'fld9AMqRVe',  // 完成时间
  'fldGMwh5dR'   // 学习进度
];

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Submit training data
app.post('/api/submit-training', (req, res) => {
  const { name, phone, score, progress } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ ok: false, error: '姓名和手机号为必填项' });
  }

  // Validate phone
  if (!/^1[3-9]\d{9}$/.test(String(phone).trim())) {
    return res.status(400).json({ ok: false, error: '手机号格式不正确' });
  }

  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const progressStr = typeof progress === 'string' ? progress : JSON.stringify(progress || {});

  // Build JSON for lark-cli batch-create (fields + rows format)
  const batchJson = JSON.stringify({
    fields: FIELD_IDS,
    rows: [[
      String(name).trim(),
      String(phone).trim(),
      Number(score) || 0,
      timeStr,
      progressStr
    ]]
  });

  try {
    const cmd = `lark-cli base +record-batch-create --base-token ${BASE_TOKEN} --table-id ${TABLE_ID} --json '${batchJson}' --as user`;
    console.log('Creating record...');

    const result = execSync(cmd, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      timeout: 30000,
      env: { ...process.env, HOME: process.env.HOME }
    });

    const parsed = JSON.parse(result);

    if (parsed.ok) {
      const recordIds = parsed.data?.record_id_list || [];
      console.log(`✅ Record created: ${recordIds.join(', ')}`);
      res.json({ ok: true, recordIds });
    } else {
      console.error('❌ API error:', JSON.stringify(parsed.error));
      res.status(500).json({ ok: false, error: parsed.error?.message || '写入失败' });
    }
  } catch (err) {
    console.error('❌ Error:', err.message);

    // Try to extract error from stderr
    let errorMsg = err.message;
    try {
      if (err.stderr) {
        const e = JSON.parse(err.stderr);
        errorMsg = e.error?.message || errorMsg;
      }
    } catch {}

    res.status(500).json({ ok: false, error: errorMsg });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🐾 宠宠它培训数据对接服务已启动: http://0.0.0.0:${PORT}`);
  console.log(`   API: POST http://0.0.0.0:${PORT}/api/submit-training`);
});
