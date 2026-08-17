import re

with open('/tmp/planopax.tsx', 'r') as f:
    content = f.read()

# Add imports
imports_to_add = """
import { useAppContext } from '../../context/AppContext';
import { getAssociados } from '../../services/associadosService';
import { Info, DollarSign, Clock, List as ListIcon, Users, MapPin, Shield, CreditCard, ArrowRight, ArrowLeft } from 'lucide-react';
"""

content = content.replace("import { SeletorItensPax } from './SeletorItensPax';", "import { SeletorItensPax } from './SeletorItensPax';" + imports_to_add)
content = content.replace("ChevronRight, ChevronLeft, Trash2, Plus", "ChevronRight, ChevronLeft, Trash2, Plus, Info, DollarSign, Clock, List as ListIcon, Users, MapPin, Shield, CreditCard, ArrowRight, ArrowLeft")

# Add state and effect for associados
state_add = """
  const { state } = useAppContext();
  const [associadosVinculados, setAssociadosVinculados] = useState<any[]>([]);
  const [loadingAssociados, setLoadingAssociados] = useState(false);

  useEffect(() => {
    const fetchAssociados = async () => {
      if (initialData?.id && state.empresaSelecionada) {
        setLoadingAssociados(true);
        try {
          const todos = await getAssociados(state.isOnline, state.empresaSelecionada);
          const vinculados = todos.filter(a => a.plano_pax_id === initialData.id && a.status === 'ativo');
          setAssociadosVinculados(vinculados);
        } catch (e) {
          console.error("Erro ao buscar associados vinculados:", e);
        } finally {
          setLoadingAssociados(false);
        }
      }
    };
    fetchAssociados();
  }, [initialData, state.empresaSelecionada, state.isOnline]);
"""

content = content.replace("const [step, setStep] = useState(1);", "const [activeTab, setActiveTab] = useState('identificacao');\n" + state_add)

with open('/tmp/planopax2.tsx', 'w') as f:
    f.write(content)

