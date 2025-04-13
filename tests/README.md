# Testing Guide for rezrov-zmachine

This directory contains the test suite for the rezrov-zmachine project. The tests are organized into different categories to help manage the testing process efficiently.

## Test Structure

- **Unit Tests**: Located in `tests/unit/`. These tests verify individual components in isolation.
- **Integration Tests**: Located in `tests/integration/`. These tests verify that components work together correctly.
- **Compliance Tests**: Located in `tests/compliance/`. These tests verify that the implementation conforms to the Z-Machine specification.
- **Fixtures**: Located in `tests/fixtures/`. These contain test data and mock content for tests.
- **Mocks**: Located in `tests/mocks/`. These contain mock objects used in testing.

## Running Tests

The project uses [Vitest](https://vitest.dev/) as the testing framework. You can run tests using the following npm scripts:

```bash
# Run all tests
npm test

# Run all tests with coverage report
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch

# Run specific test categories
npm run test:unit         # Only unit tests
npm run test:integration  # Only integration tests
npm run test:compliance   # Only compliance tests

# Run unit tests with coverage report
npm run test:unit-coverage
```

## Writing Tests

When writing new tests, follow these conventions:

1. Place tests in the appropriate category folder
2. Name test files with the `.test.ts` extension
3. Group related tests using `describe` blocks
4. Use descriptive test names in `it` or `test` blocks
5. Use the provided mock objects when appropriate

### Example Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { SomeComponent } from '../../src/path/to/component';

describe('SomeComponent', () => {
  describe('someMethod', () => {
    it('should handle normal input correctly', () => {
      // Arrange
      const component = new SomeComponent();

      // Act
      const result = component.someMethod('input');

      // Assert
      expect(result).toBe('expected output');
    });

    it('should handle edge cases', () => {
      // Test edge cases
    });
  });
});
```

## Coverage Reports

After running tests with the `--coverage` flag, you can find the coverage report in the `coverage` directory:

- Text summary in the console output
- HTML report at `coverage/index.html`
- JSON data at `coverage/coverage-final.json`

## Test Fixtures

Test fixtures should be placed in the `fixtures` directory. For Z-machine story files used in testing, consider adding small, focused story files that test specific functionality rather than using full games.
