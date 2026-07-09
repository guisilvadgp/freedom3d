const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, 'projects', 'Futebol', 'scene.json');
const fpsScriptPath = path.join(__dirname, 'projects', 'Futebol', 'scripts', 'FPSController.js');
const ballScriptPath = path.join(__dirname, 'projects', 'Futebol', 'scripts', 'BallController.js');

if (!fs.existsSync(scenePath)) {
  console.error(`Erro: scene.json não encontrado em ${scenePath}`);
  process.exit(1);
}

try {
  const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));

  // 1. Sincroniza FPSController
  if (fs.existsSync(fpsScriptPath)) {
    const fpsCode = fs.readFileSync(fpsScriptPath, 'utf8');
    const playerEntity = scene.entities['4c953004-d62e-4b5d-b0c8-1973255875c5'];
    if (playerEntity && playerEntity.components && playerEntity.components.Script) {
      playerEntity.components.Script.code = fpsCode;
      console.log('✅ FPSController.js sincronizado no scene.json');
    } else {
      console.warn('⚠️ Entidade First Person Player ou componente Script não encontrados no scene.json');
    }
  } else {
    console.warn(`⚠️ Arquivo ${fpsScriptPath} não encontrado.`);
  }

  // 2. Sincroniza BallController
  if (fs.existsSync(ballScriptPath)) {
    const ballCode = fs.readFileSync(ballScriptPath, 'utf8');
    const ballEntity = scene.entities['5ad13347-85fc-4fc4-a026-2ee5c1aaac2a'];
    if (ballEntity && ballEntity.components && ballEntity.components.Script) {
      ballEntity.components.Script.code = ballCode;
      console.log('✅ BallController.js sincronizado no scene.json');
    } else {
      console.warn('⚠️ Entidade Sphere ou componente Script não encontrados no scene.json');
    }
  } else {
    console.warn(`⚠️ Arquivo ${ballScriptPath} não encontrado.`);
  }

  // Salva de volta
  fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2), 'utf8');
  console.log('🎉 scene.json atualizado com sucesso!');
} catch (e) {
  console.error('Erro na sincronização:', e);
  process.exit(1);
}
