cat << 'INNER_EOF' > /tmp/fix.tsx
                <X className="w-5 h-5" />
              </button>
            </div>
INNER_EOF
sed -i '269r /tmp/fix.tsx' src/pages/Associados.tsx
