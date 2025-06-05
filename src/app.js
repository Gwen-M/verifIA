import fs from 'node:fs/promises';
import Tesseract from 'tesseract.js';
import figlet from 'figlet';
import { IExecDataProtectorDeserializer } from '@iexec/dataprotector-deserializer';

// Fonction pour parser le texte OCR du permis de conduire bateau
const parseBoatLicense = (text) => {
  const result = {
    documentType: 'PERMIS DE CONDUIRE BATEAU',
    nom: null,
    prenoms: null,
    dateNaissance: null,
    lieuNaissance: null,
    dateEmission: null,
    codeMedical: null,
    numeroPermis: null,
    numeroTitre: null,
    rawText: text
  };

  try {
    // Diviser le texte en lignes et nettoyer
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Chercher le nom après "1. Nom"
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('1. Nom')) {
        // Le nom peut être sur la même ligne ou la ligne suivante
        let nomLine = lines[i];
        if (i + 1 < lines.length) {
          nomLine += ' ' + lines[i + 1]; // Ajouter la ligne suivante
        }
        
        const nomMatch = nomLine.match(/\b([A-Z]{4,})\b/g);
        if (nomMatch) {
          // Prendre le dernier mot en majuscules qui n'est pas "NOM"
          const candidats = nomMatch.filter(word => word !== 'NOM' && word.length > 3);
          if (candidats.length > 0) {
            result.nom = candidats[candidats.length - 1];
          }
        }
        break;
      }
    }

    // Chercher le prénom après "2. Prénoms"
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('2. Prénoms')) {
        // Le prénom peut être sur la même ligne ou la ligne suivante
        let prenomLine = lines[i];
        if (i + 1 < lines.length) {
          prenomLine += ' ' + lines[i + 1]; // Ajouter la ligne suivante
        }
        
        const prenomMatch = prenomLine.match(/\b([A-Z]{4,})\b/g);
        if (prenomMatch) {
          // Prendre le dernier mot en majuscules qui n'est pas "PRÉNOMS"
          const candidats = prenomMatch.filter(word => !word.includes('PRÉNOM') && word.length > 3);
          if (candidats.length > 0) {
            result.prenoms = candidats[candidats.length - 1];
          }
        }
        break;
      }
    }

    const dateNaissanceMatch = text.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (dateNaissanceMatch) {
      result.dateNaissance = dateNaissanceMatch[1];
    }

    // Chercher le lieu de naissance - sur la même ligne que la date
    const ligneAvecDate = lines.find(line => line.includes(result.dateNaissance));
    if (ligneAvecDate) {
      // Extraire tout ce qui suit la date et qui est en majuscules
      const apresDate = ligneAvecDate.split(result.dateNaissance)[1];
      if (apresDate) {
        const lieuMatch = apresDate.match(/([A-Z][A-Z-']+(?:\s*[A-Z-']+)*)/);
        if (lieuMatch) {
          result.lieuNaissance = lieuMatch[1].trim();
        }
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Chercher une ligne avec un nombre de 8 chiffres suivi d'un chiffre simple
      const match = line.match(/(\d{8})\s+(\d{1,2})/);
      if (match) {
        const dateStr = match[1];
        // Convertir DDMMYYYY en DD.MM.YYYY
        result.dateEmission = `${dateStr.slice(0,2)}.${dateStr.slice(2,4)}.${dateStr.slice(4,8)}`;
        result.codeMedical = match[2];
        break;
      }
    }

    // Chercher les numéros de permis et de titre sur la dernière ligne
    const derniereLigne = lines[lines.length - 1];
    const numerosMatch = derniereLigne.match(/(\d{10})\s+([A-Z0-9]+)/);
    if (numerosMatch) {
      result.numeroPermis = numerosMatch[1];
      result.numeroTitre = numerosMatch[2];
    }

  } catch (error) {
    console.error('Erreur lors du parsing:', error);
    result.error = error.message;
  }

  return result;
};

const main = async () => {
  const { IEXEC_OUT } = process.env;
  const { IEXEC_IN } = process.env;
  const { IEXEC_DATASET_FILENAME } = process.env;

  const fileName = `0xmyimage`;
  const filePath = `${IEXEC_IN}/${fileName}`;
  if (!filePath) {
    throw new Error('Image file not found');
  }

  let computedJsonObj = {};

  try {

    const deserializer = new IExecDataProtectorDeserializer();
    // The protected data mock created for the purpose of this Hello World journey
    // contains an object with a key "secretText" which is a string
    const protectedImage = await deserializer.getValue('image', Buffer);
    console.log('Found a protected data');

    const result = await Tesseract.recognize(
      protectedImage,
      'fra'
    )
    const text = result.data.text || result.text || '';
    console.log("Text extracted from image: ", text);

    // Parser le texte pour extraire les données structurées
    const parsedData = parseBoatLicense(text);
    console.log("Données structurées extraites:", JSON.stringify(parsedData, null, 2));

    // Write result to IEXEC_OUT (maintenant avec les données structurées)
    await fs.writeFile(`${IEXEC_OUT}/result.txt`, text);
    await fs.writeFile(`${IEXEC_OUT}/parsed_data.json`, JSON.stringify(parsedData, null, 2));

    // Build the "computed.json" object
    computedJsonObj = {
      'deterministic-output-path': `${IEXEC_OUT}/result.txt`,
      'parsed-data-path': `${IEXEC_OUT}/parsed_data.json`,
      'extracted-data': parsedData
    };
  } catch (e) {
    // Handle errors
    console.log(e);

    // Build the "computed.json" object with an error message
    computedJsonObj = {
      'deterministic-output-path': IEXEC_OUT,
      'error-message': 'Oops something went wrong',
    };
  } finally {
    // Save the "computed.json" file
    await fs.writeFile(
      `${IEXEC_OUT}/computed.json`,
      JSON.stringify(computedJsonObj)
    );
  }
};

main();
