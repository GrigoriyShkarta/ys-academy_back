// export function parseFormData(obj) {
//   const result = {};
//
//   for (const key in obj) {
//     if (obj.hasOwnProperty(key)) {
//       const value = obj[key];
//       const keys = key.split(/[\[\]]/).filter((k) => k);
//       let current = result;
//
//       for (let i = 0; i < keys.length; i++) {
//         const k = keys[i];
//
//         if (i === keys.length - 1) {
//           // Если значение выглядит как JSON, парсим его
//           if (
//             typeof value === 'string' &&
//             (value.startsWith('{') || value.startsWith('['))
//           ) {
//             try {
//               current[k] = JSON.parse(value);
//             } catch {
//               current[k] = value;
//             }
//           } else {
//             current[k] = value;
//           }
//         } else {
//           if (!current[k]) {
//             // Проверяем, будет ли следующий ключ числом (для массивов)
//             const nextKey = keys[i + 1];
//             current[k] = isNaN(parseInt(nextKey)) ? {} : [];
//           }
//           current = current[k];
//         }
//       }
//     }
//   }
//
//   return result;
// }

// typescript
import qs from 'qs';
import set from 'lodash.set';

type Fields = Record<string, string>;
type MulterFile = Express.Multer.File;

export function parseFlatFormData(fields: Fields, files: MulterFile[] = []) {
  // Собираем строку query-параметров из полей (qs понимает bracket-notation)
  const qsStr = Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // Распарсим в вложенный объект
  const parsed = qs.parse(qsStr, { plainObjects: true });

  // Подставим файлы в соответствующие поля (fieldname как в форме)
  // Преобразуем fieldname вида blocks[0][items][0][content] -> blocks.0.items.0.content
  files.forEach((f) => {
    const path = f.fieldname.replace(/\]/g, '').replace(/\[/g, '.');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    set(parsed, path, f);
  });

  return parsed;
}
