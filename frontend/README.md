# 前端安装说明

## 安装依赖

如果 `npm install` 执行很慢或失败，可以尝试：

### 方法1：使用国内镜像源（推荐）

```powershell
# 设置淘宝镜像
npm config set registry https://registry.npmmirror.com

# 然后安装
npm install
```

### 方法2：使用 cnpm

```powershell
# 安装 cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com

# 使用 cnpm 安装依赖
cnpm install
```

### 方法3：使用 yarn

```powershell
# 安装 yarn（如果还没有）
npm install -g yarn

# 使用 yarn 安装
yarn install
```

## 启动开发服务器

依赖安装完成后：

```powershell
npm run dev
```

或者：

```powershell
yarn dev
```

前端服务将在 http://localhost:3000 启动。

## 常见问题

### vite 命令无法识别

**原因**：依赖未安装或安装不完整

**解决**：
1. 删除 `node_modules` 文件夹（如果存在）
2. 删除 `package-lock.json`（如果存在）
3. 重新运行 `npm install`
4. 确保安装过程中没有错误

### 安装很慢

使用国内镜像源可以大幅提升安装速度（见方法1）。

### 端口被占用

编辑 `vite.config.ts`，修改端口号。

