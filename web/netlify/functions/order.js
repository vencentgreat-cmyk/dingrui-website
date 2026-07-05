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

  const webhook = process.env.DINGTALK_ORDER_WEBHOOK || process.env.DINGTALK_WEBHOOK;
  const secret = process.env.DINGTALK_ORDER_SECRET || process.env.DINGTALK_SECRET;
  if (!webhook) return json(500, { error: 'Missing DingTalk webhook environment variable' });

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const required = ['contact', 'phone', 'deliveryMethod', 'pickupLocation', 'product1', 'quantity1'];
  for (const key of required) {
    if (!String(data[key] || '').trim()) return json(400, { error: `Missing field: ${key}` });
  }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const orderId = `DRKL-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const products = [];
  for (let i = 1; i <= 8; i += 1) {
    const p = String(data[`product${i}`] || '').trim();
    const q = String(data[`quantity${i}`] || '').trim();
    if (p || q) products.push(`${products.length + 1}. ${p || '未填写产品'} × ${q || '未填写数量'}`);
  }

  const text = `【官网客户下单提醒】\n\n订单号：${orderId}\n客户姓名：${data.contact}\n联系电话：${data.phone}\n客户公司：${data.company || '未填写'}\n\n提货方式：${data.deliveryMethod}\n提货地点：${data.pickupLocation}\n收货地址：${data.address || '未填写'}\n期望时间：${data.deliveryTime || '未填写'}\n\n订购产品：\n${products.join('\n')}\n\n付款状态：${data.payment || '未填写'}\n付款凭证备注：${data.voucherNote || '未填写'}\n备注：${data.notes || '无'}\n\n请销售/内勤确认协议价格、库存、提货/配送和付款安排。`;

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

  return json(200, { ok: true, orderId });
};
