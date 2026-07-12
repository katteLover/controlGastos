import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('Falta la variable de entorno GEMINI_API_KEY en el servidor.');
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Envía una imagen codificada en Base64 al modelo Gemini para extraer
 * de manera estructurada los campos clave del ticket de compra.
 */
export async function analyzeTicket(base64Data: string, mimeType: string) {
  // Inicializamos el modelo optimizado para visión y estructuración JSON rápida
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json', // Garantiza que la salida sea JSON válido
    },
  });

  const prompt = `
    Analiza detalladamente la imagen de este ticket de compra, factura o recibo suministrado.
    Tu tarea es extraer de forma sumamente precisa la información financiera y estructurarla en un objeto JSON estricto.
    
    Las categorías permitidas para los productos individuales son UNICAMENTE una de las siguientes 10 opciones:
    "Alimentación", "Transporte", "Salud", "Hogar", "Entretenimiento", "Ropa", "Tecnología", "Educación", "Viajes", "Otros".
    Clasifica de manera lógica cada producto según el nombre que aparezca en el ticket.

    Estructura requerida del JSON de respuesta:
    {
      "establecimiento": "Nombre comercial del comercio o empresa emisora",
      "fecha": "Fecha de la transacción en formato YYYY-MM-DD (si no se encuentra, pon la fecha actual)",
      "total": 0.00 (Número flotante o decimal con el importe total neto pagado),
      "moneda": "Código ISO de 3 letras de la divisa, ej: EUR, USD, COP, MXN (por defecto EUR)",
      "productos": [
        {
          "nombre": "Descripción limpia del artículo o producto comprado",
          "categoria": "Una de las 10 categorías permitidas mencionadas arriba",
          "precio_unitario": 0.00 (Precio por unidad del producto),
          "cantidad": 1 (Número entero de unidades compradas),
          "precio_total": 0.00 (Importe total del item: precio_unitario * cantidad)
        }
      ]
    }

    Reglas críticas de extracción:
    - No inventes información. Si no detectas productos, deja el array vacío.
    - Asegúrate de que la suma de "precio_total" de los productos concuerde razonablemente con el campo "total" general del ticket.
    - Devuelve exclusivamente el string JSON plano, sin bloques de código markdown (\`\`\`).
  `;

  // Preparamos el payload adjuntando la información binaria de la imagen
  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: mimeType
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("Gemini no retornó un esquema JSON parseable: " + text);
  }
}