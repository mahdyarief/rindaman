const fs = require("fs");

module.exports = {
  name: "🔴 Category 23: Security Vulnerabilities (AI Slop Risk)",
  run(context, reporter) {
    const criticalSecurityPatterns = [
      { regex: /\beval\s*\(/, label: "eval()" },
      { regex: /new\s+Function\s*\(/, label: "new Function()" },
      { regex: /^(?=.*dangerouslySetInnerHTML)(?!.*DOMPurify\.sanitize).*$/i, label: "dangerouslySetInnerHTML" },
      { regex: /\.innerHTML\s*=(?!=)/, label: "innerHTML assignment" },
      { regex: /document\.write\s*\(/, label: "document.write()" },
      { regex: /^(?!.*(?:Err|ERR|CODE|ENUM)).*(?:password|passwd|secret|apiKey|api_key|privateKey|private_key)\s*(?:[:=])\s*["'][^"']{5,}["']/i, label: "hardcoded credential" },
      { regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: "hardcoded private key" },
      { regex: /sk-[a-zA-Z0-9]{20,}/, label: "OpenAI API key" },
      { regex: /rejectUnauthorized\s*:\s*false/, label: "TLS certificate verification disabled" },
      { regex: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]0['"]/, label: "TLS rejection disabled via env var" },
      { regex: /InsecureSkipVerify\s*:\s*true/, label: "Go: TLS InsecureSkipVerify=true" },
      { regex: /["'`]\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b[^"'`]*["'`]\s*\+/i, label: "SQL string concatenation" },
      { regex: /fmt\.Sprintf\s*\(\s*["'`][^"'`]*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)[^"'`]*["'`]/i, label: "Go: fmt.Sprintf() building SQL" },
      { regex: /Math\.random\(\)/, label: "Math.random() — NOT cryptographically secure", contextRegex: /(?:token|secret|key|session|nonce|csrf|id)/i },
    ];

    const warnSecurityPatterns = [
      { regex: /localStorage\.setItem\s*\(\s*["'][^"']*(?:token|session|password|secret|key)["']/i, label: "Sensitive data in localStorage" },
      { regex: /sessionStorage\.setItem\s*\(\s*["'][^"']*(?:token|session|password|secret|key)["']/i, label: "Sensitive data in sessionStorage" },
      { regex: /createHash\s*\(\s*["']md5["']\)/, label: "MD5" },
      { regex: /createHash\s*\(\s*["']sha1["']\)/, label: "SHA-1" },
      { regex: /createCipher(?:iv)?\s*\(\s*["'](?:aes-\d+-)ecb["']/, label: "AES-ECB mode" },
      { regex: /["'`][^"'`]*\?(?:token|apikey|api_key|password|secret|key)=[^"'`]*["'`]/i, label: "Secret in URL query string" },
      { regex: /["'`]http:\/\/(?!localhost[:/]|127\.|0\.0\.0\.0|10\.|192\.168\.|::1)/, label: "Non-HTTPS URL to external host" },
      { regex: /(?:res\.json|res\.send|c\.JSON)\s*\(\s*(?:\{[^}]*)?(?:err|error)\.stack/, label: "Stack trace in API response" },
      { regex: /(?:res\.json|res\.send|c\.JSON)\s*\(\s*(?:\{[^}]*)?(?:err|error)\.message/, label: "Raw error message in API response" },
      { regex: /\w+\[\s*req\.(?:body|query|params)\b/, label: "Bracket notation with request data" },
      { regex: /(?:algorithms?)\s*:\s*\[\s*["']none["']/, label: "JWT 'none' algorithm" },
      { regex: /jwt\.verify\s*\([^)]*,\s*(?:null|undefined|false)\s*[,)]/, label: "JWT verify() with null/false key" },
      { regex: /['"]Access-Control-Allow-Origin['"]\s*[:]\s*['"][*]['"]|allowedOrigins?\s*:\s*\[?\s*['"][*]['"]/, label: "CORS wildcard origin" },
      { regex: /cors\s*\(\s*\)/, label: "cors() with no config" },
      { regex: /rand\.Intn|rand\.Float|rand\.Int\(/, label: "Go: math/rand" },
    ];

    let securityClean = true;
    for (const file of context.sourceFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");

      for (const { regex, label, contextRegex } of criticalSecurityPatterns) {
        if (regex.test(content)) {
          lines.forEach((line, i) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
            if (regex.test(line)) {
              if (contextRegex && !contextRegex.test(line)) return;
              reporter.fail(`Security [${label}] at ${file}:${i + 1}`);
              securityClean = false;
            }
          });
        }
      }

      for (const { regex, label } of warnSecurityPatterns) {
        if (regex.test(content)) {
          lines.forEach((line, i) => {
            if (regex.test(line)) {
              reporter.warn(`Security warning [${label}] at ${file}:${i + 1}`);
              securityClean = false;
            }
          });
        }
      }
    }
    if (securityClean) reporter.pass("No security vulnerability patterns found.");
  }
};
