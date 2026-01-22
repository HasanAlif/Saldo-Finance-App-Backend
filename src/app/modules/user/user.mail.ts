import config from "../../../config";

export const OtpEmailTemplate = (otp: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${config.site_name || "Saldo"}</h1>
    </div>
    <div style="padding: 40px 30px; text-align: center;">
      <h2 style="color: #333; margin: 0 0 10px;">Password Reset OTP</h2>
      <p style="color: #666; margin: 0 0 30px;">Use the code below to reset your password</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 0 0 30px;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
      </div>
      <p style="color: #999; font-size: 14px; margin: 0;">This code expires in 15 minutes</p>
    </div>
    <div style="background: #f8f9fa; padding: 20px; text-align: center;">
      <p style="color: #999; font-size: 12px; margin: 0;">If you didn't request this, please ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;

export const WelcomeEmailTemplate = (name: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to ${config.site_name || "Saldo"}!</h1>
    </div>
    <div style="padding: 40px 30px;">
      <h2 style="color: #333; margin: 0 0 20px;">Hi ${name},</h2>
      <p style="color: #666; line-height: 1.6; margin: 0 0 20px;">
        Thank you for joining us! Your account has been created successfully.
      </p>
      <p style="color: #666; line-height: 1.6; margin: 0;">
        If you have any questions, feel free to reach out to our support team.
      </p>
    </div>
    <div style="background: #f8f9fa; padding: 20px; text-align: center;">
      <p style="color: #999; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} ${config.site_name || "Saldo"}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
