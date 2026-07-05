const crypto = require('crypto');

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function signWebhook(webhook, secret) {
  if (!secret) return webhook;
  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;
  const sign = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
  const connector = webhook.includes('?') ? '&' : '?';
  return `${webhook}${connector}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const webhook = process.env.DINGTALK_SERVICE_WEBHOOK || process.env.DINGTALK_INQUIRY_WEBHOOK || process.env.DINGTALK_WEBHOOK;
  const secret = process.env.DINGTALK_SERVICE_SECRET || process.env.DINGTALK_INQUIRY_SECRET || process.env.DINGTALK_SECRET;
  if (!webhook) return json(500, { error: 'Missing DingTalk webhook environment variable' });

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const required = ['name', 'phone'];
  for (const key of required) {
    if (!String(data[key] || '').trim()) return json(400, { error: `Missing field: ${key}` });
  }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const inquiryId = `DRKL-INQ-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const text = `【官网在线询价提醒】\n\n询价编号：${inquiryId}\n客户姓名：${data.name}\n联系电话：${data.phone}\n客户公司：${data.company || '未填写'}\n所在地区：${data.region || '未填写'}\n\n所需产品：${data.product || '未填写'}\n预计用量：${data.quantity || '未填写'}\n项目类型：${data.projectType || '未填写'}\n留言内容：${data.message || '无'}\n\n请网页客服/销售人员尽快联系客户。`;

  const dingtalkUrl = signWebhook(webhook, secret);
  const resp = await fetch(dingtalkUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ msgtype: 'text', text: { content: text } })
  });

  const resultText = await resp.text();
  if (!resp.ok || !resultText.includes('"errcode":0')) {
    return json(502, { error: 'DingTalk push failed', detail: resultText });
  }

  return json(200, { ok: true, inquiryId });
};
