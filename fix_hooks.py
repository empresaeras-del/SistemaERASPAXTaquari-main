import re

with open('src/components/planos-pax/PlanoPaxForm.tsx', 'r') as f:
    content = f.read()

# Replace the specific block of code
old_code = """  if (!isOpen) return null;

  const tipo_plano = watch('tipo_plano');
  const regra_calculo = watch('regra_calculo');

  useEffect(() => {
    if (tipo_plano === 'coletivo') {
      setValue('regra_calculo', 'fixo', { shouldValidate: true });
    }
  }, [tipo_plano, setValue]);"""

new_code = """  const tipo_plano = watch('tipo_plano');
  const regra_calculo = watch('regra_calculo');

  useEffect(() => {
    if (tipo_plano === 'coletivo') {
      setValue('regra_calculo', 'fixo', { shouldValidate: true });
    }
  }, [tipo_plano, setValue]);

  if (!isOpen) return null;"""

content = content.replace(old_code, new_code)

with open('src/components/planos-pax/PlanoPaxForm.tsx', 'w') as f:
    f.write(content)
