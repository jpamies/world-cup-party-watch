import fs from 'fs';

const rawData = fs.readFileSync('scripts/academy/youth-proposals.json', 'utf8');
const proposals = JSON.parse(rawData.replace(/^\uFEFF/, '')); // Remove BOM

// Corrección 1: Pepe brasileño (1962) matcheado con Pepe Reina español
const pepe = proposals.find(p => p.key === 'José Macia');
if (pepe) {
  pepe.tmId = '';
  pepe.tmName = '';
  pepe.proposedYouth = [];
  pepe.confidence = 'reviewed';
  pepe.note = 'Jugador antiguo sin perfil en Transfermarkt. Auto-match con Pepe Reina español es incorrecto.';
  pepe.differs = false;
}

// Corrección 2: Ado brasileño (1970) matcheado con Amadou Onana
const ado = proposals.find(p => p.key === 'Ado (footballer)');
if (ado) {
  ado.tmId = '';
  ado.tmName = '';
  ado.proposedYouth = [];
  ado.confidence = 'reviewed';
  ado.note = 'Jugador antiguo sin perfil en Transfermarkt. Auto-match con Amadou Onana belga es incorrecto.';
  ado.differs = false;
}

// Corrección 3: Edu brasileño (1970) matcheado con Camavinga
const edu = proposals.find(p => p.key === 'Edu (footballer, born 1949)');
if (edu) {
  edu.tmId = '';
  edu.tmName = '';
  edu.proposedYouth = [];
  edu.confidence = 'reviewed';
  edu.note = 'Jugador antiguo sin perfil en Transfermarkt. Auto-match con Eduardo Camavinga francés es incorrecto.';
  edu.differs = false;
}

// Corrección 4: Müller brasileño (1994) - cambiar a perfil correcto
const muller = proposals.find(p => p.key === 'Müller (footballer, born 1966)');
if (muller) {
  muller.tmId = '102587';
  muller.tmName = 'Müller';
  muller.proposedYouth = [{club: 'FC Operário', years: null}];
  muller.confidence = 'reviewed';
  muller.note = 'Corregido: perfil brasileño correcto (Luís Antônio Corrêa da Costa), no Thomas Müller alemán.';
  muller.differs = true;
}

// Corrección 5: Marcos portero brasileño (2002) - cambiar a perfil correcto
const marcos = proposals.find(p => p.key === 'Marcos Roberto Silveira Reis');
if (marcos) {
  marcos.tmId = '30421';
  marcos.tmName = 'Marcos';
  marcos.proposedYouth = [
    {club: 'C.A. Lençoense', years: null},
    {club: 'S.E. Palmeiras São Paulo', years: null}
  ];
  marcos.confidence = 'reviewed';
  marcos.note = 'Corregido: perfil brasileño correcto (portero Marcos), no Marquinhos joven.';
  marcos.differs = true;
}

// Corrección 6: Júnior brasileño (2002) - cambiar a perfil correcto
const junior = proposals.find(p => p.key === 'Júnior (footballer, born 1973)');
if (junior) {
  junior.tmId = '17284';
  junior.tmName = 'Júnior Baiano';
  junior.proposedYouth = [];
  junior.confidence = 'reviewed';
  junior.note = 'Corregido: perfil brasileño correcto (Júnior Baiano), no Vinicius Junior joven. Sin cantera en TM.';
  junior.differs = true;
}

fs.writeFileSync('scripts/academy/youth-proposals.json', JSON.stringify(proposals, null, 2), 'utf8');
console.log('✓ Homónimos corregidos');
