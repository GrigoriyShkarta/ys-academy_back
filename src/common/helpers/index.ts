// Обход и очистка ссылок в content
import { LessonBlock, LessonNode } from '../types/helpTypes';

export const cleanNodesArray = (
  nodes?: LessonNode[] | null,
  idSet?: Set<number>,
): LessonNode[] => {
  if (!Array.isArray(nodes)) return [];
  const result: LessonNode[] = [];

  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;

    const props = node.props ?? {};
    const raw = props['name'];
    let idNum: number | undefined;
    if (typeof raw === 'number') idNum = raw;
    else if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) idNum = parsed;
    }

    // Если это аудио и ссылается на удаляемое id — пропускаем (удаляем) этот узел
    if (
      (node.type === 'audio' ||
        node.type === 'video' ||
        node.type === 'youtube' ||
        node.type === 'image') &&
      typeof idNum === 'number' &&
      idSet?.has(idNum)
    ) {
      continue;
    }

    // Иначе создаём поверхностную копию узла и рекурсивно очищаем его children/content
    const newNode: LessonNode = { ...node };

    if (Array.isArray(newNode.children)) {
      newNode.children = cleanNodesArray(newNode.children);
    }
    if (Array.isArray(newNode.content)) {
      newNode.content = cleanNodesArray(newNode.content);
    }

    result.push(newNode);
  }

  return result;
};

export const collectAudioIds = (content: LessonBlock[]): number[] => {
  const audioIds = new Set<number>();
  const collect = (node: LessonNode): void => {
    if (!node || typeof node !== 'object') return;
    const type = node.type;
    const props = node.props ?? {};
    const raw = props['bankId'] ?? props['name'];

    let idNum: number | undefined;
    if (typeof raw === 'number') idNum = raw;
    else if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) idNum = parsed;
    }

    if (typeof idNum === 'number' && type === 'audio') audioIds.add(idNum);

    const children = Array.isArray(node.children)
      ? node.children
      : Array.isArray(node.content)
        ? node.content
        : [];

    for (const c of children) collect(c);
  };

  for (const block of content) {
    const nodes = Array.isArray(block?.content) ? block.content : [];
    for (const n of nodes) collect(n);
  }

  return Array.from(audioIds);
};

export const collectPhotoIds = (content: LessonBlock[]): number[] => {
  const photoIds = new Set<number>();
  const collect = (node: LessonNode): void => {
    if (!node || typeof node !== 'object') return;
    const type = node.type;
    const props = node.props ?? {};
    const raw = props['name'];

    let idNum: number | undefined;
    if (typeof raw === 'number') idNum = raw;
    else if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) idNum = parsed;
    }

    if (typeof idNum === 'number' && (type === 'image' || type === 'photo'))
      photoIds.add(idNum);

    const children = Array.isArray(node.children)
      ? node.children
      : Array.isArray(node.content)
        ? node.content
        : [];

    for (const c of children) collect(c);
  };

  for (const block of content) {
    const nodes = Array.isArray(block?.content) ? block.content : [];
    for (const n of nodes) collect(n);
  }

  return Array.from(photoIds);
};

export const collectVideoIds = (content: LessonBlock[]): number[] => {
  const videoIds = new Set<number>();
  const collect = (node: LessonNode): void => {
    if (!node || typeof node !== 'object') return;
    const type = node.type;
    const props = node.props ?? {};
    const raw = props['name'];

    let idNum: number | undefined;
    if (typeof raw === 'number') idNum = raw;
    else if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) idNum = parsed;
    }

    if (typeof idNum === 'number' && (type === 'video' || type === 'youtube'))
      videoIds.add(idNum);

    const children = Array.isArray(node.children)
      ? node.children
      : Array.isArray(node.content)
        ? node.content
        : [];

    for (const c of children) collect(c);
  };

  for (const block of content) {
    const nodes = Array.isArray(block?.content) ? block.content : [];
    for (const n of nodes) collect(n);
  }

  return Array.from(videoIds);
};
