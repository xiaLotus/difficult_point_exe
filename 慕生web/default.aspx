<%@ Page Language="C#" AutoEventWireup="true"
    ResponseEncoding="utf-8"
    ContentType="text/html; charset=utf-8"
%>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>用戶認證資訊</title>
    <style>
        body { font-family: Microsoft JhengHei, sans-serif; padding: 20px; }
        .info { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .user-id { font-size: 24px; color: #2c3e50; font-weight: bold; }
    </style>
</head>
<body>
<%
    string remoteUser = Request.ServerVariables["REMOTE_USER"];
    string authUser   = Request.ServerVariables["AUTH_USER"];
    string logonUser  = Request.ServerVariables["LOGON_USER"];

    // 解析 "KH\\K18251" → "K18251"
    string rawUser = remoteUser ?? authUser ?? logonUser ?? "";
    string cleanUser = rawUser.Contains("\\") ? rawUser.Split('\\')[1] : rawUser;
%>

    <!-- <h2>✅ 認證成功</h2>
    
    <div class="info">
        <p><strong>REMOTE_USER:</strong> <%= Server.HtmlEncode(remoteUser ?? "(空)") %></p>
        <p><strong>AUTH_USER:</strong> <%= Server.HtmlEncode(authUser ?? "(空)") %></p>
        <p><strong>LOGON_USER:</strong> <%= Server.HtmlEncode(logonUser ?? "(空)") %></p>
    </div>
    
    <div class="info">
        <p>解析後工號：</p>
        <p class="user-id"><%= Server.HtmlEncode(cleanUser) %></p>
    </div>

 
    <div style="margin-top: 20px;">
        <button onclick="goToPage('List.html')">前往 List.html</button>
        <button onclick="goToPage('index.html')">前往 index.html</button>
    </div> -->

    <script>
        // 儲存到 localStorage（供其他頁面使用）
        localStorage.setItem("loggedUser", "<%= Server.HtmlEncode(cleanUser) %>");
        

        const user = "<%= Server.HtmlEncode(cleanUser) %>";

        console.log(user)
        localStorage.setItem(user, "User");

        window.location.href = "List.html"

    </script>
</body>
</html>