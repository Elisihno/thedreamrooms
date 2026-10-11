// Image URL helper. A single-file build can supply data URIs through window.__IMG.
export const img = (name) => window.__IMG?.[name] ?? import.meta.env.BASE_URL + 'img/' + name;
