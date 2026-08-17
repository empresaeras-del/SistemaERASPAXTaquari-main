import os
import re

def add_query_param(file_path, route_prefix, id_prop):
    with open(file_path, 'r') as f:
        content = f.read()

    # Search for navigate(`/financeiro/contas-a-receber/${parcela.receita_id || parcela.id}/editar`)
    # and replace with navigate(`/financeiro/contas-a-receber/${parcela.receita_id || parcela.id}/editar?parcela=${parcela.id}`)

    # There might be two places (one for table row, one for modal)
    pattern = r'navigate\(`(' + route_prefix + r'\$\{([^}]+)\}/editar)`\)'
    replacement = r'navigate(`\1?parcela=${parcela.id}`)'
    
    # Let's do a smarter replace.
    # In ContasReceberPage.tsx:
    # navigate(`/financeiro/contas-a-receber/${parcela.receita_id || parcela.id}/editar`)
    # and in modal: navigate(`/financeiro/contas-a-receber/${parcelaDetalhes.receita_id || parcelaDetalhes.id}/editar`);
    
    content = content.replace(
        "navigate(`/financeiro/contas-a-receber/${parcela.receita_id || parcela.id}/editar`)", 
        "navigate(`/financeiro/contas-a-receber/${parcela.receita_id || parcela.id}/editar?parcela=${parcela.id}`)"
    )
    content = content.replace(
        "navigate(`/financeiro/contas-a-receber/${parcelaDetalhes.receita_id || parcelaDetalhes.id}/editar`)", 
        "navigate(`/financeiro/contas-a-receber/${parcelaDetalhes.receita_id || parcelaDetalhes.id}/editar?parcela=${parcelaDetalhes.id}`)"
    )
    content = content.replace(
        "navigate(`/financeiro/contas-a-pagar/${parcela.despesa_id || parcela.id}/editar`)", 
        "navigate(`/financeiro/contas-a-pagar/${parcela.despesa_id || parcela.id}/editar?parcela=${parcela.id}`)"
    )
    content = content.replace(
        "navigate(`/financeiro/contas-a-pagar/${parcelaDetalhes.despesa_id || parcelaDetalhes.id}/editar`)", 
        "navigate(`/financeiro/contas-a-pagar/${parcelaDetalhes.despesa_id || parcelaDetalhes.id}/editar?parcela=${parcelaDetalhes.id}`)"
    )

    with open(file_path, 'w') as f:
        f.write(content)

add_query_param('src/pages/ContasReceberPage.tsx', '/financeiro/contas-a-receber/', 'receita_id')
add_query_param('src/pages/ContasPagarPage.tsx', '/financeiro/contas-a-pagar/', 'despesa_id')
