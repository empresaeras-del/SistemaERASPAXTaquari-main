import re
with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

if "useSearchParams" not in content:
    content = content.replace("import React, { useState, useEffect, useMemo } from 'react';", "import React, { useState, useEffect, useMemo } from 'react';\nimport { useSearchParams, useNavigate } from 'react-router-dom';")

with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
