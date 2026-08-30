import { nanoid } from 'nanoid';

/** 生成短 ID（实体主键）。 */
export const newId = (): string => nanoid(10);
