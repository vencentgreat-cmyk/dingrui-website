# 鼎瑞康隆官网客户下单 + 钉钉群推送

## 部署方法

1. 把本文件夹里的 `index.html` 和 `netlify/functions/order.js` 上传/提交到 Netlify 项目。
2. 进入 Netlify 后台：Site configuration / Environment variables。
3. 新增两个环境变量：

```text
DINGTALK_WEBHOOK=钉钉自定义机器人的 Webhook 地址
DINGTALK_SECRET=钉钉自定义机器人的加签 Secret
```

4. 重新部署网站。
5. 打开官网顶部导航的“客户下单”，填写测试订单。
6. 钉钉群应收到“官网客户下单提醒”。

注意：Webhook 和 Secret 不要写进 HTML，也不要公开发送。
