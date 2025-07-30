package middleware

import (
	"net/http"
	"strings"
	"sync"
)

// DynamicAuthenticator 支持动态更新认证令牌的认证器
type DynamicAuthenticator struct {
	mu    sync.RWMutex
	token string
}

// NewDynamicAuthenticator 创建一个新的动态认证器
func NewDynamicAuthenticator(token string) *DynamicAuthenticator {
	return &DynamicAuthenticator{
		token: token,
	}
}

// UpdateToken 更新认证令牌
func (da *DynamicAuthenticator) UpdateToken(newToken string) {
	da.mu.Lock()
	defer da.mu.Unlock()
	da.token = newToken
}

// GetToken 获取当前认证令牌
func (da *DynamicAuthenticator) GetToken() string {
	da.mu.RLock()
	defer da.mu.RUnlock()
	return da.token
}

// Middleware 返回认证中间件
func (da *DynamicAuthenticator) Middleware() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 获取当前令牌
			currentToken := da.GetToken()
			
			// 如果令牌为空字符串，则禁用认证，直接通过
			if currentToken == "" {
				next.ServeHTTP(w, r)
				return
			}

			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Authorization header is required", http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, "Authorization header format must be Bearer {token}", http.StatusUnauthorized)
				return
			}

			if parts[1] != currentToken {
				http.Error(w, "Invalid token", http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
