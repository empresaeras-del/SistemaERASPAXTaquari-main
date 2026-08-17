import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

find_fim = """                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : ("""

replace_fim = """                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : ("""

content = content.replace(find_fim, replace_fim)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

