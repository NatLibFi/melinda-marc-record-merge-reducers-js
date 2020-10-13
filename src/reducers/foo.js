export default function(base, source) {
  base.insertFields(source.fields.slice(-1));
  return base;
}
