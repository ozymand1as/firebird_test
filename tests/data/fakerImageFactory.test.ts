import {createFakerImageFactory} from '../../src/data/images/fakerImageFactory';

describe('Faker image factory', () => {
  it('delegates to Faker with supplied dimensions', () => {
    const url = jest.fn().mockReturnValue('https://example.test/image');
    const factory = createFakerImageFactory({image: {url}});

    expect(factory.createImageUri({width: 32, height: 32})).toBe('https://example.test/image');
    expect(factory.createImageUri({width: 300, height: 300})).toBe('https://example.test/image');
    expect(url).toHaveBeenNthCalledWith(1, {width: 32, height: 32});
    expect(url).toHaveBeenNthCalledWith(2, {width: 300, height: 300});
  });

  it.each([
    {width: 0, height: 300},
    {width: -1, height: 300},
    {width: 32.5, height: 300},
    {width: Number.POSITIVE_INFINITY, height: 300},
    {width: 300, height: 0},
    {width: 300, height: -1},
    {width: 300, height: 32.5},
    {width: 300, height: Number.NaN},
  ])('rejects invalid dimensions %p before calling Faker', dimensions => {
    const url = jest.fn();
    const factory = createFakerImageFactory({image: {url}});

    expect(() => factory.createImageUri(dimensions)).toThrow('Image dimensions must be positive integers.');
    expect(url).not.toHaveBeenCalled();
  });
});
